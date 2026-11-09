// @ts-check
/**
 * The PetController file is a very simple one, which does not need to be changed manually,
 * unless there's a case where business logic routes the request to an entity which is not
 * the service.
 * The heavy lifting of the Controller item is done in Request.js - that is where request
 * parameters are extracted and sent to the service, and where response is handled.
 */

const Controller = require("./Controller");
/** @type {typeof import('../../../server-adapters/PetService.ts')} */
const service = require("../services/PetService");
/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const addPet = async (request, response) => {
  await Controller.handleRequest(request, response, service.addPet);
};

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const deletePet = async (request, response) => {
  await Controller.handleRequest(request, response, service.deletePet);
};

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const findPetsByStatus = async (request, response) => {
  await Controller.handleRequest(request, response, service.findPetsByStatus);
};

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const findPetsByTags = async (request, response) => {
  await Controller.handleRequest(request, response, service.findPetsByTags);
};

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const getPetById = async (request, response) => {
  await Controller.handleRequest(request, response, service.getPetById);
};

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const searchPets = async (request, response) => {
  await Controller.handleRequest(request, response, service.searchPets);
};

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const updatePet = async (request, response) => {
  await Controller.handleRequest(request, response, service.updatePet);
};

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const updatePetWithForm = async (request, response) => {
  await Controller.handleRequest(request, response, service.updatePetWithForm);
};

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
const uploadPetImage = async (request, response) => {
  await Controller.handleRequest(request, response, service.uploadPetImage);
};

module.exports = {
  addPet,
  deletePet,
  findPetsByStatus,
  findPetsByTags,
  getPetById,
  searchPets,
  updatePet,
  updatePetWithForm,
  uploadPetImage,
  AddPet: addPet,
  DeletePet: deletePet,
  FindPetsByStatus: findPetsByStatus,
  FindPetsByTags: findPetsByTags,
  GetPetById: getPetById,
  SearchPets: searchPets,
  UpdatePet: updatePet,
  UpdatePetWithForm: updatePetWithForm,
  UploadPetImage: uploadPetImage,
};
