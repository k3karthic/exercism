import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { GenericContainer, Wait } from "testcontainers";
import request from "supertest";
import type { Response as SupertestResponse } from "supertest";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

import { app } from "./app.js";
import { closeDatabase, getDatabase } from "./database.ts";
import {
  OrderSearchCriteriaSortByEnum,
  OrderSearchCriteriaSortOrderEnum,
  OrderStatus,
  PetSearchCriteriaSortByEnum,
  PetSearchCriteriaSortOrderEnum,
  PetStatus,
} from "./generated/client/models/index.ts";
import { petStore } from "./store.ts";

const API_KEY = "some-api-key";
const POSTGRES_USER = "petstore";
const POSTGRES_PASSWORD = "petstore";
const POSTGRES_DATABASE = "petstore";

let databaseContainer:
  | Awaited<ReturnType<GenericContainer["start"]>>
  | undefined;
let originalDatabaseUrl: string | undefined;

beforeAll(async () => {
  databaseContainer = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_USER,
      POSTGRES_PASSWORD,
      POSTGRES_DB: POSTGRES_DATABASE,
    })
    .withExposedPorts(5432)
    .withWaitStrategy(
      Wait.forLogMessage(/database system is ready to accept connections/, 2),
    )
    .start();

  const databaseUrl = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${databaseContainer.getHost()}:${databaseContainer.getMappedPort(5432)}/${POSTGRES_DATABASE}`;
  originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  await migrate(getDatabase(), {
    migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)),
  });
}, 120_000);

afterAll(async () => {
  await closeDatabase();
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
  await databaseContainer?.stop();
});

beforeEach(async () => {
  await getDatabase().execute(
    sql`TRUNCATE TABLE "order", pet RESTART IDENTITY`,
  );
});

async function createPet(
  name = "Rex",
  status: PetStatus = PetStatus.Available,
  petId?: number,
): Promise<SupertestResponse> {
  const payload: Record<string, unknown> = {
    name,
    photoUrls: ["https://example.com/photo.jpg"],
    status,
  };

  if (petId !== undefined) {
    payload.id = petId;
  }

  const response = await request(app)
    .post("/pet")
    .set("api_key", API_KEY)
    .send(payload);
  expect(response.status, response.text).toBe(200);
  return response;
}

async function createOrder(
  status: OrderStatus = OrderStatus.Placed,
  orderId?: number,
): Promise<SupertestResponse> {
  const payload: Record<string, unknown> = {
    petId: 1,
    quantity: 2,
    status,
    complete: false,
  };

  if (orderId !== undefined) {
    payload.id = orderId;
  }

  return request(app)
    .post("/store/order")
    .set("api_key", API_KEY)
    .send(payload);
}

test("add and get pet", async () => {
  const created = await createPet("Buddy");
  expect(created.status).toBe(200);
  expect(created.body.name).toBe("Buddy");
  expect(created.body.id).toBeTypeOf("number");

  const fetched = await request(app)
    .get(`/pet/${created.body.id as number}`)
    .set("api_key", API_KEY);

  expect(fetched.status).toBe(200);
  expect(fetched.body.name).toBe("Buddy");
});

test("add pet keeps supplied id", async () => {
  const created = await createPet("Spot", PetStatus.Pending, 7);
  expect(created.status).toBe(200);
  expect(created.body.id).toBe(7);

  const replaced = await createPet("Spot Updated", PetStatus.Sold, 7);
  expect(replaced.body.name).toBe("Spot Updated");

  const nextPet = await createPet("Next");
  expect(nextPet.body.id).toBe(8);
});

test("update pet", async () => {
  const created = await createPet("Mittens");
  const updated = await request(app)
    .put("/pet")
    .set("api_key", API_KEY)
    .send({
      ...created.body,
      name: "Mittens Updated",
      photoUrls: created.body.photoUrls,
    });

  expect(updated.status).toBe(200);
  expect(updated.body.name).toBe("Mittens Updated");
});

test("update pet with form data", async () => {
  const created = await createPet("Whiskers");

  const updated = await request(app)
    .post(`/pet/${created.body.id as number}`)
    .set("api_key", API_KEY)
    .query({ name: "Whiskers2", status: PetStatus.Sold });

  expect(updated.status).toBe(200);

  const fetched = await request(app)
    .get(`/pet/${created.body.id as number}`)
    .set("api_key", API_KEY);

  expect(fetched.body.name).toBe("Whiskers2");
  expect(fetched.body.status).toBe(PetStatus.Sold);
});

test("delete pet", async () => {
  const created = await createPet("Goldie");

  const deleted = await request(app)
    .delete(`/pet/${created.body.id as number}`)
    .set("api_key", API_KEY);

  expect(deleted.status).toBe(200);

  const fetched = await request(app)
    .get(`/pet/${created.body.id as number}`)
    .set("api_key", API_KEY);
  expect(fetched.status).toBe(404);
});

test("find pets by status", async () => {
  await createPet("AvailPet", PetStatus.Available);
  await createPet("SoldPet", PetStatus.Sold);

  const response = await request(app)
    .get("/pet/findByStatus")
    .set("api_key", API_KEY)
    .query({ status: PetStatus.Available });

  expect(response.status, JSON.stringify(response.body)).toBe(200);
  expect(response.body.map((pet: { name: string }) => pet.name)).toContain(
    "AvailPet",
  );
  expect(response.body.map((pet: { name: string }) => pet.name)).not.toContain(
    "SoldPet",
  );
});

test("find pets by tags", async () => {
  const created = await request(app)
    .post("/pet")
    .set("api_key", API_KEY)
    .send({
      name: "TaggedPet",
      photoUrls: [],
      status: PetStatus.Available,
      tags: [{ name: "fluffy" }],
    });

  expect(created.status).toBe(200);

  const response = await request(app)
    .get("/pet/findByTags")
    .set("api_key", API_KEY)
    .query({ tags: "fluffy" });

  expect(response.status).toBe(200);
  expect(response.body.map((pet: { name: string }) => pet.name)).toContain(
    "TaggedPet",
  );
});

test("upload image", async () => {
  const created = await createPet("PhotoPet");

  const response = await request(app)
    .post(`/pet/${created.body.id as number}/uploadImage`)
    .set("api_key", API_KEY)
    .set("content-type", "application/octet-stream")
    .send(Buffer.from("fake-image-data"));

  expect(response.status).toBe(200);
  expect(response.body.code).toBe(200);
});

test("pet route requires api key", async () => {
  const response = await request(app).get("/pet/1");
  expect(response.status).toBe(403);
});

test("get missing pet returns 404", async () => {
  const response = await request(app)
    .get("/pet/999999")
    .set("api_key", API_KEY);
  expect(response.status).toBe(404);
});

test("place and get order", async () => {
  const created = await createOrder(OrderStatus.Placed);
  expect(created.status).toBe(200);
  expect(created.body.id).toBeTypeOf("number");
  expect(created.body.quantity).toBe(2);

  const fetched = await request(app)
    .get(`/store/order/${created.body.id as number}`)
    .set("api_key", API_KEY);

  expect(fetched.status).toBe(200);
  expect(fetched.body.status).toBe(OrderStatus.Placed);
});

test("place order keeps supplied id", async () => {
  const created = await createOrder(OrderStatus.Placed, 7);
  expect(created.status).toBe(200);
  expect(created.body.id).toBe(7);

  const replaced = await createOrder(OrderStatus.Delivered, 7);
  expect(replaced.body.status).toBe(OrderStatus.Delivered);

  const nextOrder = await createOrder();
  expect(nextOrder.body.id).toBe(8);
});

test("delete order", async () => {
  const created = await createOrder(OrderStatus.Approved);

  const deleted = await request(app)
    .delete(`/store/order/${created.body.id as number}`)
    .set("api_key", API_KEY);

  expect(deleted.status).toBe(200);

  const fetched = await request(app)
    .get(`/store/order/${created.body.id as number}`)
    .set("api_key", API_KEY);
  expect(fetched.status).toBe(404);
});

test("get missing order returns 404", async () => {
  const response = await request(app)
    .get("/store/order/999999")
    .set("api_key", API_KEY);
  expect(response.status).toBe(404);
});

test("inventory counts pet statuses", async () => {
  await createPet("InvPet1", PetStatus.Available);
  await createPet("InvPet2", PetStatus.Available);
  await createPet("InvPet3", PetStatus.Sold);

  const response = await request(app)
    .get("/store/inventory")
    .set("api_key", API_KEY);

  expect(response.status).toBe(200);
  expect(response.body.available).toBeGreaterThanOrEqual(2);
  expect(response.body.sold).toBeGreaterThanOrEqual(1);
});

test("search pets", async () => {
  await createPet("Searchable", PetStatus.Available);

  const response = await request(app)
    .post("/pet/search")
    .set("api_key", API_KEY)
    .query({ limit: 10, offset: 0 })
    .send({
      name: "Search*",
      status: [PetStatus.Available],
      sortBy: "name",
      sortOrder: "asc",
    });

  expect(response.status).toBe(200);
  expect(response.body.results).toHaveLength(1);
});

test("search orders", async () => {
  await createOrder(OrderStatus.Delivered);

  const response = await request(app)
    .post("/store/order/search")
    .set("api_key", API_KEY)
    .query({ page: 1, pageSize: 10 })
    .send({
      status: [OrderStatus.Delivered],
      complete: false,
      sortBy: "shipDate",
      sortOrder: "desc",
    });

  expect(response.status).toBe(200);
  expect(response.body.orders).toHaveLength(1);
});

test("store creates, upserts, updates, and deletes pets", async () => {
  const created = await petStore.createPet({
    id: 50,
    name: "Direct",
    photoUrls: [],
    status: PetStatus.Available,
  });
  expect(created.id).toBe(50);

  const upserted = await petStore.createPet({
    id: 50,
    name: "Upserted",
    photoUrls: [],
  });
  expect(upserted.name).toBe("Upserted");

  expect(await petStore.updatePet({ name: "No id", photoUrls: [] })).toBe(
    undefined,
  );
  expect(
    await petStore.updatePet({ id: 999, name: "Missing", photoUrls: [] }),
  ).toBe(undefined);
  const updated = await petStore.updatePet({
    id: 50,
    name: "Updated",
    photoUrls: [],
    tags: [{ name: "calm" }],
  });
  expect(updated?.name).toBe("Updated");

  expect(await petStore.getPet(999)).toBe(undefined);
  expect(await petStore.updatePetFromForm(50, undefined, undefined)).toBe(true);
  expect(await petStore.updatePetFromForm(999, undefined, undefined)).toBe(
    false,
  );
  expect(await petStore.updatePetFromForm(50, "Renamed", PetStatus.Sold)).toBe(
    true,
  );
  expect(await petStore.findPetsByStatus(PetStatus.Sold)).toHaveLength(1);
  expect(await petStore.findPetsByTags([])).toHaveLength(1);
  expect(await petStore.findPetsByTags(["calm"])).toHaveLength(1);
  expect(await petStore.inventory()).toEqual({ sold: 1 });
  expect(await petStore.deletePet(50)).toBe(true);
  expect(await petStore.deletePet(50)).toBe(false);
});

test("store searches pets with filters, sorting, and paging", async () => {
  await petStore.createPet({
    name: "Alpha",
    photoUrls: [],
    status: PetStatus.Available,
    tags: [{ name: "tame" }],
  });
  await petStore.createPet({
    name: "Beta",
    photoUrls: [],
    status: PetStatus.Sold,
  });

  const everything = await petStore.searchPets({}, 1, 0);
  expect(everything).toMatchObject({ total: 2, hasMore: true });

  const filtered = await petStore.searchPets(
    {
      name: "*alp*",
      status: [PetStatus.Available],
      tags: ["tame"],
      sortBy: PetSearchCriteriaSortByEnum.Status,
      sortOrder: PetSearchCriteriaSortOrderEnum.Desc,
    },
    10,
    0,
  );
  expect(filtered.results.map((pet) => pet.name)).toEqual(["Alpha"]);
});

test("store creates, upserts, and deletes orders", async () => {
  const created = await petStore.createOrder({ id: 70, quantity: 1 });
  expect(created.id).toBe(70);
  const generated = await petStore.createOrder({
    petId: 1,
    shipDate: "2024-01-01T00:00:00.000Z",
    status: OrderStatus.Placed,
    complete: true,
  });
  expect(generated.complete).toBe(true);
  expect(await petStore.getOrder(999)).toBe(undefined);
  expect(await petStore.deleteOrder(70)).toBe(true);
  expect(await petStore.deleteOrder(70)).toBe(false);
});

test("store searches orders with ranges, sorting, and paging", async () => {
  for (const [index, status] of [
    OrderStatus.Placed,
    OrderStatus.Approved,
    OrderStatus.Delivered,
  ].entries()) {
    await petStore.createOrder({
      petId: index + 1,
      quantity: index + 1,
      shipDate: `2024-01-0${index + 1}T00:00:00.000Z`,
      status,
      complete: index === 2,
    });
  }

  const ranged = await petStore.searchOrders(
    {
      dateRange: {
        from: "2024-01-02T00:00:00.000Z",
        to: "2024-01-03T00:00:00.000Z",
      },
      quantityRange: { min: 2, max: 2 },
      sortBy: OrderSearchCriteriaSortByEnum.Quantity,
      sortOrder: OrderSearchCriteriaSortOrderEnum.Asc,
    },
    1,
    10,
  );
  expect(ranged.orders).toHaveLength(1);
  expect(ranged.pagination.totalResults).toBe(1);

  const filtered = await petStore.searchOrders(
    {
      orderId: 3,
      petId: 3,
      status: [OrderStatus.Delivered],
      complete: true,
      sortBy: OrderSearchCriteriaSortByEnum.PetId,
    },
    1,
    10,
  );
  expect(filtered.orders).toHaveLength(1);

  const empty = await petStore.searchOrders(
    { sortBy: OrderSearchCriteriaSortByEnum.Id },
    1,
    10,
  );
  expect(empty.pagination.totalPages).toBe(1);
  const none = await petStore.searchOrders({ petId: 99 }, 1, 10);
  expect(none.pagination.totalPages).toBe(0);
});

test("validation failures return 422 with details", async () => {
  const response = await request(app)
    .post("/pet")
    .set("api_key", API_KEY)
    .send({ photoUrls: [] });

  expect(response.status).toBe(422);
  expect(response.body.message).toBe("Validation Failed");
  expect(response.body.details).toBeDefined();
});

test("malformed JSON bodies keep their error status", async () => {
  const response = await request(app)
    .post("/pet")
    .set("api_key", API_KEY)
    .set("content-type", "application/json")
    .send("{not json");

  expect(response.status).toBe(400);
  expect(response.body.message).toBeTypeOf("string");
});
