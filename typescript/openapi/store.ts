import { and, count, eq, inArray, sql, type SQL } from "drizzle-orm";
import type {
  Order,
  OrderSearchCriteria,
  OrderSearchResults,
  Pet,
  PetSearchCriteria,
  PetSearchResults,
  PetStatus,
} from "./generated/client/models/index.ts";
import { getDatabase } from "./database.ts";
import { orders, pets } from "./schema.ts";

function petFromRow(row: typeof pets.$inferSelect): Pet {
  return {
    id: row.id,
    name: row.name,
    photoUrls: [...row.photoUrls],
    ...(row.category === null ? {} : { category: { ...row.category } }),
    tags: row.tags.map((tag) => ({ ...tag })),
    ...(row.status === null ? {} : { status: row.status }),
  };
}

function orderFromRow(row: typeof orders.$inferSelect): Order {
  return {
    id: row.id,
    ...(row.petId === null ? {} : { petId: row.petId }),
    ...(row.quantity === null ? {} : { quantity: row.quantity }),
    ...(row.shipDate === null ? {} : { shipDate: row.shipDate.toISOString() }),
    ...(row.status === null ? {} : { status: row.status }),
    complete: row.complete,
  };
}

function sortValues<T>(values: T[], key: keyof T, order: "asc" | "desc"): T[] {
  const direction = order === "desc" ? -1 : 1;
  return [...values].sort((left, right) => {
    const leftValue = left[key];
    const rightValue = right[key];

    if (leftValue === rightValue) {
      return 0;
    }

    if (leftValue === undefined || leftValue === null) {
      return -direction;
    }

    if (rightValue === undefined || rightValue === null) {
      return direction;
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }

    return String(leftValue).localeCompare(String(rightValue)) * direction;
  });
}

function orderMatchesRanges(criteria: OrderSearchCriteria) {
  const from =
    criteria.dateRange?.from === undefined
      ? undefined
      : new Date(criteria.dateRange.from).getTime();
  const to =
    criteria.dateRange?.to === undefined
      ? undefined
      : new Date(criteria.dateRange.to).getTime();
  const minimumQuantity = criteria.quantityRange?.min;
  const maximumQuantity = criteria.quantityRange?.max;

  return (order: Order): boolean => {
    if (order.shipDate !== undefined) {
      const shipTime = new Date(order.shipDate).getTime();
      if (from !== undefined && shipTime < from) {
        return false;
      }
      if (to !== undefined && shipTime > to) {
        return false;
      }
    }

    const quantity = order.quantity ?? 0;
    return (
      (minimumQuantity === undefined || quantity >= minimumQuantity) &&
      (maximumQuantity === undefined || quantity <= maximumQuantity)
    );
  };
}

const ORDER_SORT_FIELDS = ["shipDate", "petId", "quantity", "status"] as const;

function orderSortField(
  sortBy: string,
): (typeof ORDER_SORT_FIELDS)[number] | "id" {
  return ORDER_SORT_FIELDS.find((field) => field === sortBy) ?? "id";
}

function petFilters(criteria: PetSearchCriteria): SQL | undefined {
  const filters: SQL[] = [];
  if (criteria.status !== undefined && criteria.status.length > 0) {
    filters.push(inArray(pets.status, criteria.status));
  }
  for (const tag of criteria.tags ?? []) {
    filters.push(
      sql`${pets.tags} @> ${JSON.stringify([{ name: tag }])}::jsonb`,
    );
  }
  return filters.length === 0 ? undefined : and(...filters);
}

async function advancePetSequence(): Promise<void> {
  await getDatabase().execute(sql`
    SELECT setval(
      pg_get_serial_sequence('pet', 'id'),
      GREATEST(
        1,
        COALESCE(pg_sequence_last_value(pg_get_serial_sequence('pet', 'id')::regclass), 0),
        (SELECT COALESCE(MAX(id), 0) FROM pet)
      ),
      true
    )
  `);
}

async function advanceOrderSequence(): Promise<void> {
  await getDatabase().execute(sql`
    SELECT setval(
      pg_get_serial_sequence('order', 'id'),
      GREATEST(
        1,
        COALESCE(pg_sequence_last_value(pg_get_serial_sequence('order', 'id')::regclass), 0),
        (SELECT COALESCE(MAX(id), 0) FROM "order")
      ),
      true
    )
  `);
}

class PetStore {
  public async createPet(pet: Pet): Promise<Pet> {
    const values = {
      name: pet.name,
      photoUrls: pet.photoUrls,
      category: pet.category ?? null,
      tags: pet.tags ?? [],
      status: pet.status ?? null,
    };
    const insert = getDatabase()
      .insert(pets)
      .values(pet.id === undefined ? values : { ...values, id: pet.id });
    const [row] =
      pet.id === undefined
        ? await insert.returning()
        : await insert
            .onConflictDoUpdate({ target: pets.id, set: values })
            .returning();

    if (row === undefined) {
      throw new Error("Creating a pet did not return the inserted row");
    }
    if (pet.id !== undefined) {
      await advancePetSequence();
    }
    return petFromRow(row);
  }

  public async updatePet(pet: Pet): Promise<Pet | undefined> {
    if (pet.id === undefined) {
      return undefined;
    }

    const [row] = await getDatabase()
      .update(pets)
      .set({
        name: pet.name,
        photoUrls: pet.photoUrls,
        category: pet.category ?? null,
        tags: pet.tags ?? [],
        status: pet.status ?? null,
      })
      .where(eq(pets.id, pet.id))
      .returning();

    return row === undefined ? undefined : petFromRow(row);
  }

  public async getPet(petId: number): Promise<Pet | undefined> {
    const [row] = await getDatabase()
      .select()
      .from(pets)
      .where(eq(pets.id, petId))
      .limit(1);

    return row === undefined ? undefined : petFromRow(row);
  }

  public async deletePet(petId: number): Promise<boolean> {
    const deleted = await getDatabase()
      .delete(pets)
      .where(eq(pets.id, petId))
      .returning({ id: pets.id });
    return deleted.length > 0;
  }

  public async updatePetFromForm(
    petId: number,
    name: string | undefined,
    status: PetStatus | undefined,
  ): Promise<boolean> {
    const values: { name?: string; status?: PetStatus | null } = {};
    if (name !== undefined) {
      values.name = name;
    }
    if (status !== undefined) {
      values.status = status;
    }

    if (Object.keys(values).length === 0) {
      return (await this.getPet(petId)) !== undefined;
    }

    const updated = await getDatabase()
      .update(pets)
      .set(values)
      .where(eq(pets.id, petId))
      .returning({ id: pets.id });
    return updated.length > 0;
  }

  public async findPetsByStatus(status: PetStatus): Promise<Pet[]> {
    const rows = await getDatabase()
      .select()
      .from(pets)
      .where(eq(pets.status, status));
    return rows.map(petFromRow);
  }

  public async findPetsByTags(tags: string[]): Promise<Pet[]> {
    const filters = tags.map(
      (tag) => sql`${pets.tags} @> ${JSON.stringify([{ name: tag }])}::jsonb`,
    );
    const rows = await getDatabase()
      .select()
      .from(pets)
      .where(filters.length === 0 ? undefined : and(...filters));
    return rows.map(petFromRow);
  }

  public async searchPets(
    criteria: PetSearchCriteria,
    limit: number,
    offset: number,
  ): Promise<PetSearchResults> {
    const nameFilter = criteria.name?.replaceAll("*", "").toLowerCase();
    const matched = (
      await getDatabase().select().from(pets).where(petFilters(criteria))
    )
      .map(petFromRow)
      .filter(
        (pet) => !nameFilter || pet.name.toLowerCase().includes(nameFilter),
      );

    const sortBy = criteria.sortBy ?? "name";
    const sortField = sortBy === "status" ? "status" : "name";
    const sorted = sortValues(matched, sortField, criteria.sortOrder ?? "asc");
    const total = sorted.length;

    return {
      results: sorted.slice(offset, offset + limit),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  public async inventory(): Promise<Record<string, number>> {
    const rows = await getDatabase()
      .select({ status: pets.status, count: count() })
      .from(pets)
      .groupBy(pets.status);
    const inventory: Record<string, number> = {};
    for (const row of rows) {
      if (row.status !== null) {
        inventory[row.status] = row.count;
      }
    }
    return inventory;
  }

  public async createOrder(order: Order): Promise<Order> {
    const values = {
      petId: order.petId ?? null,
      quantity: order.quantity ?? null,
      shipDate:
        order.shipDate === undefined ? new Date() : new Date(order.shipDate),
      status: order.status ?? null,
      complete: order.complete ?? false,
    };
    const insert = getDatabase()
      .insert(orders)
      .values(order.id === undefined ? values : { ...values, id: order.id });
    const [row] =
      order.id === undefined
        ? await insert.returning()
        : await insert
            .onConflictDoUpdate({ target: orders.id, set: values })
            .returning();

    if (row === undefined) {
      throw new Error("Creating an order did not return the inserted row");
    }
    if (order.id !== undefined) {
      await advanceOrderSequence();
    }
    return orderFromRow(row);
  }

  public async getOrder(orderId: number): Promise<Order | undefined> {
    const [row] = await getDatabase()
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    return row === undefined ? undefined : orderFromRow(row);
  }

  public async deleteOrder(orderId: number): Promise<boolean> {
    const deleted = await getDatabase()
      .delete(orders)
      .where(eq(orders.id, orderId))
      .returning({ id: orders.id });
    return deleted.length > 0;
  }

  public async searchOrders(
    criteria: OrderSearchCriteria,
    page: number,
    pageSize: number,
  ): Promise<OrderSearchResults> {
    const filters: SQL[] = [];
    if (criteria.orderId !== undefined) {
      filters.push(eq(orders.id, criteria.orderId));
    }
    if (criteria.petId !== undefined) {
      filters.push(eq(orders.petId, criteria.petId));
    }
    if (criteria.status !== undefined && criteria.status.length > 0) {
      filters.push(inArray(orders.status, criteria.status));
    }
    if (criteria.complete !== undefined) {
      filters.push(eq(orders.complete, criteria.complete));
    }

    let matched = (
      await getDatabase()
        .select()
        .from(orders)
        .where(filters.length === 0 ? undefined : and(...filters))
    ).map(orderFromRow);

    matched = matched.filter(orderMatchesRanges(criteria));

    const sortField = orderSortField(criteria.sortBy ?? "shipDate");
    const sorted = sortValues(matched, sortField, criteria.sortOrder ?? "desc");
    const totalResults = sorted.length;
    const start = (page - 1) * pageSize;

    return {
      orders: sorted.slice(start, start + pageSize),
      pagination: {
        page,
        pageSize,
        totalPages: totalResults === 0 ? 0 : Math.ceil(totalResults / pageSize),
        totalResults,
      },
    };
  }
}

export const petStore = new PetStore();
