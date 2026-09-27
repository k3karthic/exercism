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

export function getInventory(): Record<string, number> {
  return petStore.inventory();
}

export function placeOrder({ order }: { order: Order }): Order {
  return petStore.createOrder(order);
}

export function searchOrders({
  orderSearchCriteria,
  page,
  pageSize,
}: OrderSearchRequest): OrderSearchResults {
  return petStore.searchOrders(orderSearchCriteria, page ?? 1, pageSize ?? 20);
}

export function getOrderById({ orderId }: { orderId: number }): Order {
  const order = petStore.getOrder(orderId);
  if (order === undefined) {
    throw new OrderNotFoundError();
  }
  return order;
}

export function deleteOrder({
  orderId,
}: {
  orderId: number;
}): Record<string, never> {
  if (!petStore.deleteOrder(orderId)) {
    throw new OrderNotFoundError();
  }
  return {};
}
