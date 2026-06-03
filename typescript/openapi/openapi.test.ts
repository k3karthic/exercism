import request from "supertest";
import type { Response as SupertestResponse } from "supertest";
import { beforeEach, expect, test } from "vitest";

import { app } from "./app.js";
import { OrderStatus, PetStatus } from "./models.js";
import { petStore } from "./store.js";

const API_KEY = "some-api-key";

beforeEach(() => {
  petStore.reset();
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

  return request(app).post("/pet").set("api_key", API_KEY).send(payload);
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

  expect(response.status).toBe(200);
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
