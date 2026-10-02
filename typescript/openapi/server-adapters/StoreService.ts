import type {
  ErrorResponse,
  Order,
  OrderSearchCriteria,
  OrderSearchResults,
} from "../generated/client/models/index.ts";
import { petStore } from "../store.ts";

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

export async function getInventory(): Promise<Record<string, number>> {
  return petStore.inventory();
}

export async function placeOrder({ order }: { order: Order }): Promise<Order> {
  return petStore.createOrder(order);
}

export function searchOrders({ orderSearchCriteria, page, pageSize }: OrderSearchRequest): Promise<OrderSearchResults> {
  return petStore.searchOrders(orderSearchCriteria, page ?? 1, pageSize ?? 20);
}

export async function getOrderById({ orderId }: { orderId: number }): Promise<Order> {
  const order = await petStore.getOrder(orderId);
  if (order === undefined) {
    throw new OrderNotFoundError();
  }
  return order;
}

export async function deleteOrder({ orderId }: { orderId: number }): Promise<Record<string, never>> {
  if (!(await petStore.deleteOrder(orderId))) {
    throw new OrderNotFoundError();
  }
  return {};
}
