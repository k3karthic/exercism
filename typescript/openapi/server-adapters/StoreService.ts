import { createRequire } from "node:module";

import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type {
  ErrorResponse,
  Order,
  OrderSearchCriteria,
  OrderSearchResults,
} from "../generated/client/models/index.ts";
import { getDatabase } from "../database.ts";
import { orders } from "../schema.ts";
import { sortValues } from "./utils.js";

const requireCjs = createRequire(import.meta.url);

class OrderNotFoundError extends Error {
  public readonly code = 404;
  public readonly error: ErrorResponse;

  public constructor() {
    super("Order not found");
    this.error = { message: this.message };
  }
}

interface OrderSearchRequest {
  orderSearchCriteria: OrderSearchCriteria;
  page?: number;
  pageSize?: number;
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

function parseDateRange(criteria: OrderSearchCriteria) {
  return {
    from: criteria.dateRange?.from === undefined ? undefined : new Date(criteria.dateRange.from).getTime(),
    to: criteria.dateRange?.to === undefined ? undefined : new Date(criteria.dateRange.to).getTime(),
  };
}

function matchesDateRange(order: Order, criteria: OrderSearchCriteria): boolean {
  if (order.shipDate === undefined) return true;
  const { from, to } = parseDateRange(criteria);
  const shipTime = new Date(order.shipDate).getTime();
  if (from !== undefined && shipTime < from) return false;
  if (to !== undefined && shipTime > to) return false;
  return true;
}

function matchesQuantityRange(order: Order, criteria: OrderSearchCriteria): boolean {
  const quantity = order.quantity ?? 0;
  const min = criteria.quantityRange?.min;
  const max = criteria.quantityRange?.max;
  if (min !== undefined && quantity < min) return false;
  if (max !== undefined && quantity > max) return false;
  return true;
}

function orderMatchesRanges(criteria: OrderSearchCriteria) {
  return (order: Order): boolean => matchesDateRange(order, criteria) && matchesQuantityRange(order, criteria);
}

const ORDER_SORT_FIELDS = ["shipDate", "petId", "quantity", "status"] as const;

function orderSortField(sortBy: string): (typeof ORDER_SORT_FIELDS)[number] | "id" {
  return ORDER_SORT_FIELDS.find((field) => field === sortBy) ?? "id";
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

function orderToDbValues(order: Order) {
  return {
    petId: order.petId ?? null,
    quantity: order.quantity ?? null,
    shipDate: order.shipDate === undefined ? new Date() : new Date(order.shipDate),
    status: order.status ?? null,
    complete: order.complete ?? false,
  };
}

export async function createOrderDb(order: Order): Promise<Order> {
  const values = orderToDbValues(order);
  const insert = getDatabase()
    .insert(orders)
    .values(order.id === undefined ? values : { ...values, id: order.id });
  const [row] =
    order.id === undefined
      ? await insert.returning()
      : await insert.onConflictDoUpdate({ target: orders.id, set: values }).returning();
  if (row === undefined) {
    throw new Error("Creating an order did not return the inserted row");
  }
  if (order.id !== undefined) {
    await advanceOrderSequence();
  }
  return orderFromRow(row);
}

export async function getOrderDb(orderId: number): Promise<Order | undefined> {
  const [row] = await getDatabase().select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return row === undefined ? undefined : orderFromRow(row);
}

export async function deleteOrderDb(orderId: number): Promise<boolean> {
  const deleted = await getDatabase().delete(orders).where(eq(orders.id, orderId)).returning({ id: orders.id });
  return deleted.length > 0;
}

function buildOrderFilters(criteria: OrderSearchCriteria): SQL | undefined {
  const filters: SQL[] = [];
  if (criteria.orderId !== undefined) filters.push(eq(orders.id, criteria.orderId));
  if (criteria.petId !== undefined) filters.push(eq(orders.petId, criteria.petId));
  if (criteria.status !== undefined && criteria.status.length > 0)
    filters.push(inArray(orders.status, criteria.status));
  if (criteria.complete !== undefined) filters.push(eq(orders.complete, criteria.complete));
  return filters.length === 0 ? undefined : and(...filters);
}

export async function searchOrdersDb(
  criteria: OrderSearchCriteria,
  page: number,
  pageSize: number,
): Promise<OrderSearchResults> {
  const matched = (await getDatabase().select().from(orders).where(buildOrderFilters(criteria))).map(orderFromRow);
  const filtered = matched.filter(orderMatchesRanges(criteria));
  const sortField = orderSortField(criteria.sortBy ?? "shipDate");
  const sorted = sortValues(filtered, sortField, criteria.sortOrder ?? "desc");
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

export function getInventory(): Record<string, number> {
  // Inventory counts pet statuses, not orders — imported from PetService
  const { inventoryDb } = requireCjs("./PetService.ts");
  return inventoryDb();
}

export async function placeOrder({ order }: { order: Order }): Promise<Order> {
  return createOrderDb(order);
}

export function searchOrders({ orderSearchCriteria, page, pageSize }: OrderSearchRequest): Promise<OrderSearchResults> {
  return searchOrdersDb(orderSearchCriteria, page ?? 1, pageSize ?? 20);
}

export async function getOrderById({ orderId }: { orderId: number }): Promise<Order> {
  const order = await getOrderDb(orderId);
  if (order === undefined) {
    throw new OrderNotFoundError();
  }
  return order;
}

export async function deleteOrder({ orderId }: { orderId: number }): Promise<Record<string, never>> {
  if (!(await deleteOrderDb(orderId))) {
    throw new OrderNotFoundError();
  }
  return {};
}
