import {
  Body,
  Controller,
  Delete,
  Get,
  Path,
  Post,
  Query,
  Res,
  Response,
  Route,
  Security,
  Tags,
  type TsoaResponse,
} from "tsoa";

import {
  type ErrorResponse,
  type Order,
  type OrderSearchCriteria,
  type OrderSearchResults,
  type Pet,
} from "../models.js";
import { petStore } from "../store.js";

@Route("store")
@Tags("Store")
export class StoreController extends Controller {
  @Security("api_key")
  @Get("inventory")
  public async getInventory(): Promise<Record<string, number>> {
    return petStore.inventory();
  }

  @Security("api_key")
  @Post("order")
  public async placeOrder(@Body() order: Order): Promise<Order> {
    return petStore.createOrder(order);
  }

  @Security("api_key")
  @Post("order/search")
  public async searchOrders(
    @Body() criteria: OrderSearchCriteria,
    @Query() page = 1,
    @Query() pageSize = 20,
  ): Promise<OrderSearchResults> {
    return petStore.searchOrders(criteria, page, pageSize);
  }

  @Response<ErrorResponse>(404, "Order not found")
  @Security("api_key")
  @Get("order/{orderId}")
  public async getOrderById(
    @Path() orderId: number,
    @Res() notFound: TsoaResponse<404, ErrorResponse>,
  ): Promise<Order | void> {
    const order = petStore.getOrder(orderId);
    if (order === undefined) {
      return notFound(404, { message: "Order not found" });
    }

    return order;
  }

  @Response<ErrorResponse>(404, "Order not found")
  @Security("api_key")
  @Delete("order/{orderId}")
  public async deleteOrder(
    @Path() orderId: number,
    @Res() notFound: TsoaResponse<404, ErrorResponse>,
  ): Promise<Record<string, never> | void> {
    if (!petStore.deleteOrder(orderId)) {
      return notFound(404, { message: "Order not found" });
    }

    return {};
  }
}
