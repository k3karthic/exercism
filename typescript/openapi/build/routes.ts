/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from "@tsoa/runtime";
import { fetchMiddlewares, ExpressTemplateService } from "@tsoa/runtime";
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { StoreController } from "./../controllers/StoreController.js";
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { PetController } from "./../controllers/PetController.js";
import { expressAuthentication } from "./../auth.js";
// @ts-ignore - no great way to install types from subpackage
import type {
  Request as ExRequest,
  Response as ExResponse,
  RequestHandler,
  Router,
} from "express";

const expressAuthenticationRecasted = expressAuthentication as (
  req: ExRequest,
  securityName: string,
  scopes?: string[],
  res?: ExResponse,
) => Promise<any>;

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
  "Record_string.number_": {
    dataType: "refAlias",
    type: {
      dataType: "nestedObjectLiteral",
      nestedProperties: {},
      additionalProperties: { dataType: "double" },
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  OrderStatus: {
    dataType: "refEnum",
    enums: ["placed", "approved", "delivered"],
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  Order: {
    dataType: "refObject",
    properties: {
      id: { dataType: "double" },
      petId: { dataType: "double" },
      quantity: { dataType: "double" },
      shipDate: { dataType: "string" },
      status: { ref: "OrderStatus" },
      complete: { dataType: "boolean" },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  OrderSearchResults: {
    dataType: "refObject",
    properties: {
      orders: {
        dataType: "array",
        array: { dataType: "refObject", ref: "Order" },
        required: true,
      },
      pagination: {
        dataType: "nestedObjectLiteral",
        nestedProperties: {
          totalResults: { dataType: "double", required: true },
          totalPages: { dataType: "double", required: true },
          pageSize: { dataType: "double", required: true },
          page: { dataType: "double", required: true },
        },
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  DateRange: {
    dataType: "refObject",
    properties: {
      from: { dataType: "string" },
      to: { dataType: "string" },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  QuantityRange: {
    dataType: "refObject",
    properties: {
      min: { dataType: "double" },
      max: { dataType: "double" },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  OrderSearchCriteria: {
    dataType: "refObject",
    properties: {
      orderId: { dataType: "double" },
      petId: { dataType: "double" },
      status: {
        dataType: "array",
        array: { dataType: "refEnum", ref: "OrderStatus" },
      },
      complete: { dataType: "boolean" },
      dateRange: { ref: "DateRange" },
      quantityRange: { ref: "QuantityRange" },
      sortBy: {
        dataType: "union",
        subSchemas: [
          { dataType: "enum", enums: ["shipDate"] },
          { dataType: "enum", enums: ["petId"] },
          { dataType: "enum", enums: ["quantity"] },
          { dataType: "enum", enums: ["status"] },
          { dataType: "enum", enums: ["id"] },
        ],
      },
      sortOrder: {
        dataType: "union",
        subSchemas: [
          { dataType: "enum", enums: ["asc"] },
          { dataType: "enum", enums: ["desc"] },
        ],
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  "Record_string.unknown_": {
    dataType: "refAlias",
    type: {
      dataType: "nestedObjectLiteral",
      nestedProperties: {},
      additionalProperties: { dataType: "any" },
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ErrorResponse: {
    dataType: "refObject",
    properties: {
      message: { dataType: "string", required: true },
      details: { ref: "Record_string.unknown_" },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  "Record_string.never_": {
    dataType: "refAlias",
    type: {
      dataType: "nestedObjectLiteral",
      nestedProperties: {},
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  Category: {
    dataType: "refObject",
    properties: {
      id: { dataType: "double" },
      name: { dataType: "string" },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  Tag: {
    dataType: "refObject",
    properties: {
      id: { dataType: "double" },
      name: { dataType: "string" },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  PetStatus: {
    dataType: "refEnum",
    enums: ["available", "pending", "sold"],
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  Pet: {
    dataType: "refObject",
    properties: {
      id: { dataType: "double" },
      name: { dataType: "string", required: true },
      photoUrls: {
        dataType: "array",
        array: { dataType: "string" },
        required: true,
      },
      category: { ref: "Category" },
      tags: { dataType: "array", array: { dataType: "refObject", ref: "Tag" } },
      status: { ref: "PetStatus" },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  PetSearchResults: {
    dataType: "refObject",
    properties: {
      results: {
        dataType: "array",
        array: { dataType: "refObject", ref: "Pet" },
        required: true,
      },
      total: { dataType: "double", required: true },
      limit: { dataType: "double", required: true },
      offset: { dataType: "double", required: true },
      hasMore: { dataType: "boolean", required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  PetSearchCriteria: {
    dataType: "refObject",
    properties: {
      name: { dataType: "string" },
      status: {
        dataType: "array",
        array: { dataType: "refEnum", ref: "PetStatus" },
      },
      tags: { dataType: "array", array: { dataType: "string" } },
      sortBy: {
        dataType: "union",
        subSchemas: [
          { dataType: "enum", enums: ["name"] },
          { dataType: "enum", enums: ["status"] },
        ],
      },
      sortOrder: {
        dataType: "union",
        subSchemas: [
          { dataType: "enum", enums: ["asc"] },
          { dataType: "enum", enums: ["desc"] },
        ],
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ApiResponse: {
    dataType: "refObject",
    properties: {
      code: { dataType: "double" },
      type: { dataType: "string" },
      message: { dataType: "string" },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
};
const templateService = new ExpressTemplateService(models, {
  noImplicitAdditionalProperties: "throw-on-extras",
  bodyCoercion: true,
});

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

export function RegisterRoutes(app: Router) {
  // ###########################################################################################################
  //  NOTE: If you do not see routes for all of your controllers in this file, then you might not have informed tsoa of where to look
  //      Please look into the "controllerPathGlobs" config option described in the readme: https://github.com/lukeautry/tsoa
  // ###########################################################################################################

  const argsStoreController_getInventory: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {};
  app.get(
    "/store/inventory",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(StoreController),
    ...fetchMiddlewares<RequestHandler>(StoreController.prototype.getInventory),

    async function StoreController_getInventory(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsStoreController_getInventory,
          request,
          response,
        });

        const controller = new StoreController();

        await templateService.apiHandler({
          methodName: "getInventory",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsStoreController_placeOrder: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    order: { in: "body", name: "order", required: true, ref: "Order" },
  };
  app.post(
    "/store/order",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(StoreController),
    ...fetchMiddlewares<RequestHandler>(StoreController.prototype.placeOrder),

    async function StoreController_placeOrder(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsStoreController_placeOrder,
          request,
          response,
        });

        const controller = new StoreController();

        await templateService.apiHandler({
          methodName: "placeOrder",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsStoreController_searchOrders: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    criteria: {
      in: "body",
      name: "criteria",
      required: true,
      ref: "OrderSearchCriteria",
    },
    page: { default: 1, in: "query", name: "page", dataType: "double" },
    pageSize: {
      default: 20,
      in: "query",
      name: "pageSize",
      dataType: "double",
    },
  };
  app.post(
    "/store/order/search",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(StoreController),
    ...fetchMiddlewares<RequestHandler>(StoreController.prototype.searchOrders),

    async function StoreController_searchOrders(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsStoreController_searchOrders,
          request,
          response,
        });

        const controller = new StoreController();

        await templateService.apiHandler({
          methodName: "searchOrders",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsStoreController_getOrderById: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    orderId: {
      in: "path",
      name: "orderId",
      required: true,
      dataType: "double",
    },
    notFound: { in: "res", name: "404", required: true, ref: "ErrorResponse" },
  };
  app.get(
    "/store/order/:orderId",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(StoreController),
    ...fetchMiddlewares<RequestHandler>(StoreController.prototype.getOrderById),

    async function StoreController_getOrderById(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsStoreController_getOrderById,
          request,
          response,
        });

        const controller = new StoreController();

        await templateService.apiHandler({
          methodName: "getOrderById",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsStoreController_deleteOrder: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    orderId: {
      in: "path",
      name: "orderId",
      required: true,
      dataType: "double",
    },
    notFound: { in: "res", name: "404", required: true, ref: "ErrorResponse" },
  };
  app.delete(
    "/store/order/:orderId",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(StoreController),
    ...fetchMiddlewares<RequestHandler>(StoreController.prototype.deleteOrder),

    async function StoreController_deleteOrder(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsStoreController_deleteOrder,
          request,
          response,
        });

        const controller = new StoreController();

        await templateService.apiHandler({
          methodName: "deleteOrder",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsPetController_addPet: Record<string, TsoaRoute.ParameterSchema> = {
    pet: { in: "body", name: "pet", required: true, ref: "Pet" },
  };
  app.post(
    "/pet",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(PetController),
    ...fetchMiddlewares<RequestHandler>(PetController.prototype.addPet),

    async function PetController_addPet(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsPetController_addPet,
          request,
          response,
        });

        const controller = new PetController();

        await templateService.apiHandler({
          methodName: "addPet",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsPetController_updatePet: Record<string, TsoaRoute.ParameterSchema> =
    {
      pet: { in: "body", name: "pet", required: true, ref: "Pet" },
      notFound: {
        in: "res",
        name: "404",
        required: true,
        ref: "ErrorResponse",
      },
    };
  app.put(
    "/pet",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(PetController),
    ...fetchMiddlewares<RequestHandler>(PetController.prototype.updatePet),

    async function PetController_updatePet(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsPetController_updatePet,
          request,
          response,
        });

        const controller = new PetController();

        await templateService.apiHandler({
          methodName: "updatePet",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsPetController_findPetsByStatus: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    status: {
      default: "available",
      in: "query",
      name: "status",
      ref: "PetStatus",
    },
  };
  app.get(
    "/pet/findByStatus",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(PetController),
    ...fetchMiddlewares<RequestHandler>(
      PetController.prototype.findPetsByStatus,
    ),

    async function PetController_findPetsByStatus(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsPetController_findPetsByStatus,
          request,
          response,
        });

        const controller = new PetController();

        await templateService.apiHandler({
          methodName: "findPetsByStatus",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsPetController_findPetsByTags: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    tags: {
      default: [],
      in: "query",
      name: "tags",
      dataType: "array",
      array: { dataType: "string" },
    },
  };
  app.get(
    "/pet/findByTags",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(PetController),
    ...fetchMiddlewares<RequestHandler>(PetController.prototype.findPetsByTags),

    async function PetController_findPetsByTags(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsPetController_findPetsByTags,
          request,
          response,
        });

        const controller = new PetController();

        await templateService.apiHandler({
          methodName: "findPetsByTags",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsPetController_searchPets: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    criteria: {
      in: "body",
      name: "criteria",
      required: true,
      ref: "PetSearchCriteria",
    },
    limit: { default: 20, in: "query", name: "limit", dataType: "double" },
    offset: { default: 0, in: "query", name: "offset", dataType: "double" },
  };
  app.post(
    "/pet/search",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(PetController),
    ...fetchMiddlewares<RequestHandler>(PetController.prototype.searchPets),

    async function PetController_searchPets(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsPetController_searchPets,
          request,
          response,
        });

        const controller = new PetController();

        await templateService.apiHandler({
          methodName: "searchPets",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsPetController_getPetById: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    petId: { in: "path", name: "petId", required: true, dataType: "double" },
    notFound: { in: "res", name: "404", required: true, ref: "ErrorResponse" },
  };
  app.get(
    "/pet/:petId",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(PetController),
    ...fetchMiddlewares<RequestHandler>(PetController.prototype.getPetById),

    async function PetController_getPetById(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsPetController_getPetById,
          request,
          response,
        });

        const controller = new PetController();

        await templateService.apiHandler({
          methodName: "getPetById",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsPetController_updatePetWithForm: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    petId: { in: "path", name: "petId", required: true, dataType: "double" },
    name: { in: "query", name: "name", dataType: "string" },
    status: { in: "query", name: "status", ref: "PetStatus" },
    notFound: { in: "res", name: "404", required: true, ref: "ErrorResponse" },
  };
  app.post(
    "/pet/:petId",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(PetController),
    ...fetchMiddlewares<RequestHandler>(
      PetController.prototype.updatePetWithForm,
    ),

    async function PetController_updatePetWithForm(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsPetController_updatePetWithForm,
          request,
          response,
        });

        const controller = new PetController();

        await templateService.apiHandler({
          methodName: "updatePetWithForm",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsPetController_deletePet: Record<string, TsoaRoute.ParameterSchema> =
    {
      petId: { in: "path", name: "petId", required: true, dataType: "double" },
      notFound: {
        in: "res",
        name: "404",
        required: true,
        ref: "ErrorResponse",
      },
    };
  app.delete(
    "/pet/:petId",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(PetController),
    ...fetchMiddlewares<RequestHandler>(PetController.prototype.deletePet),

    async function PetController_deletePet(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsPetController_deletePet,
          request,
          response,
        });

        const controller = new PetController();

        await templateService.apiHandler({
          methodName: "deletePet",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsPetController_uploadPetImage: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    petId: { in: "path", name: "petId", required: true, dataType: "double" },
    request: {
      in: "request",
      name: "request",
      required: true,
      dataType: "object",
    },
    additionalMetadata: {
      in: "query",
      name: "additionalMetadata",
      dataType: "string",
    },
    notFound: { in: "res", name: "404", required: true, ref: "ErrorResponse" },
  };
  app.post(
    "/pet/:petId/uploadImage",
    authenticateMiddleware([{ api_key: [] }]),
    ...fetchMiddlewares<RequestHandler>(PetController),
    ...fetchMiddlewares<RequestHandler>(PetController.prototype.uploadPetImage),

    async function PetController_uploadPetImage(
      request: ExRequest,
      response: ExResponse,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsPetController_uploadPetImage,
          request,
          response,
        });

        const controller = new PetController();

        await templateService.apiHandler({
          methodName: "uploadPetImage",
          controller,
          response,
          next,
          validatedArgs,
          successStatus: undefined,
        });
      } catch (err) {
        return next(err);
      }
    },
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

  function authenticateMiddleware(security: TsoaRoute.Security[] = []) {
    return async function runAuthenticationMiddleware(
      request: any,
      response: any,
      next: any,
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      // keep track of failed auth attempts so we can hand back the most
      // recent one.  This behavior was previously existing so preserving it
      // here
      const failedAttempts: any[] = [];
      const pushAndRethrow = (error: any) => {
        failedAttempts.push(error);
        throw error;
      };

      const secMethodOrPromises: Promise<any>[] = [];
      for (const secMethod of security) {
        if (Object.keys(secMethod).length > 1) {
          const secMethodAndPromises: Promise<any>[] = [];

          for (const name in secMethod) {
            secMethodAndPromises.push(
              expressAuthenticationRecasted(
                request,
                name,
                secMethod[name],
                response,
              ).catch(pushAndRethrow),
            );
          }

          // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

          secMethodOrPromises.push(
            Promise.all(secMethodAndPromises).then((users) => {
              return users[0];
            }),
          );
        } else {
          for (const name in secMethod) {
            secMethodOrPromises.push(
              expressAuthenticationRecasted(
                request,
                name,
                secMethod[name],
                response,
              ).catch(pushAndRethrow),
            );
          }
        }
      }

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      try {
        request["user"] = await Promise.any(secMethodOrPromises);

        // Response was sent in middleware, abort
        if (response.writableEnded) {
          return;
        }

        next();
      } catch (err) {
        // Show most recent error as response
        const error = failedAttempts.pop();
        error.status = error.status || 401;

        // Response was sent in middleware, abort
        if (response.writableEnded) {
          return;
        }
        next(error);
      }

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    };
  }

  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
