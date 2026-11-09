// @ts-check
/**
 * The StoreController file is a very simple one, which does not need to be changed manually,
 * unless there's a case where business logic routes the request to an entity which is not
 * the service.
 * The heavy lifting of the Controller item is done in Request.js - that is where request
 * parameters are extracted and sent to the service, and where response is handled.
 */

const Controller = require("./Controller");
/** @type {typeof import('../../../server-adapters/StoreService.ts')} */
const service = require("../services/StoreService");
/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const deleteOrder = async (request, response) => {
  await Controller.handleRequest(request, response, service.deleteOrder);
};

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const getInventory = async (request, response) => {
  await Controller.handleRequest(request, response, service.getInventory);
};

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const getOrderById = async (request, response) => {
  await Controller.handleRequest(request, response, service.getOrderById);
};

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const placeOrder = async (request, response) => {
  await Controller.handleRequest(request, response, service.placeOrder);
};

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const searchOrders = async (request, response) => {
  await Controller.handleRequest(request, response, service.searchOrders);
};

module.exports = {
  deleteOrder,
  getInventory,
  getOrderById,
  placeOrder,
  searchOrders,
  DeleteOrder: deleteOrder,
  GetInventory: getInventory,
  GetOrderById: getOrderById,
  PlaceOrder: placeOrder,
  SearchOrders: searchOrders,
};
