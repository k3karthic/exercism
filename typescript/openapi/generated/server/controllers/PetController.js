/**
 * The PetController file is a very simple one, which does not need to be changed manually,
 * unless there's a case where business logic routes the request to an entity which is not
 * the service.
 * The heavy lifting of the Controller item is done in Request.js - that is where request
 * parameters are extracted and sent to the service, and where response is handled.
 */

const Controller = require('./Controller');
const service = require('../services/PetService');
const addPet = async (request, response) => {
  await Controller.handleRequest(request, response, service.addPet);
};

const deletePet = async (request, response) => {
  await Controller.handleRequest(request, response, service.deletePet);
};

const findPetsByStatus = async (request, response) => {
  await Controller.handleRequest(request, response, service.findPetsByStatus);
};

const findPetsByTags = async (request, response) => {
  await Controller.handleRequest(request, response, service.findPetsByTags);
};

const getPetById = async (request, response) => {
  await Controller.handleRequest(request, response, service.getPetById);
};

const searchPets = async (request, response) => {
  await Controller.handleRequest(request, response, service.searchPets);
};

const updatePet = async (request, response) => {
  await Controller.handleRequest(request, response, service.updatePet);
};

const updatePetWithForm = async (request, response) => {
  await Controller.handleRequest(request, response, service.updatePetWithForm);
};

const uploadPetImage = async (request, response) => {
  await Controller.handleRequest(request, response, (params) =>
    service.uploadPetImage({ ...params, body: request.body }),
  );
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
};

module.exports.AddPet = addPet;
module.exports.UpdatePet = updatePet;
module.exports.FindPetsByStatus = findPetsByStatus;
module.exports.FindPetsByTags = findPetsByTags;
module.exports.SearchPets = searchPets;
module.exports.GetPetById = getPetById;
module.exports.UpdatePetWithForm = updatePetWithForm;
module.exports.DeletePet = deletePet;
module.exports.UploadPetImage = uploadPetImage;
