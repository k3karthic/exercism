import {
  Body,
  Controller,
  Delete,
  Get,
  Path,
  Post,
  Put,
  Query,
  Res,
  Response,
  Route,
  Security,
  Tags,
  Request,
  type TsoaResponse,
} from "tsoa";

import {
  type ApiResponse,
  PetStatus,
  type ErrorResponse,
  type Pet,
  type PetSearchCriteria,
  type PetSearchResults,
} from "../models.js";
import { petStore } from "../store.js";

@Route("pet")
@Tags("Pet")
export class PetController extends Controller {
  @Security("api_key")
  @Post()
  public async addPet(@Body() pet: Pet): Promise<Pet> {
    return petStore.createPet(pet);
  }

  @Security("api_key")
  @Put()
  public async updatePet(
    @Body() pet: Pet,
    @Res() notFound: TsoaResponse<404, ErrorResponse>,
  ): Promise<Pet | void> {
    const updated = petStore.updatePet(pet);
    if (updated === undefined) {
      return notFound(404, { message: "Pet not found" });
    }

    return updated;
  }

  @Security("api_key")
  @Get("findByStatus")
  public async findPetsByStatus(
    @Query() status: PetStatus = PetStatus.Available,
  ): Promise<Pet[]> {
    return petStore.findPetsByStatus(status);
  }

  @Security("api_key")
  @Get("findByTags")
  public async findPetsByTags(@Query() tags: string[] = []): Promise<Pet[]> {
    return petStore.findPetsByTags(tags);
  }

  @Security("api_key")
  @Post("search")
  public async searchPets(
    @Body() criteria: PetSearchCriteria,
    @Query() limit = 20,
    @Query() offset = 0,
  ): Promise<PetSearchResults> {
    return petStore.searchPets(criteria, limit, offset);
  }

  @Response<ErrorResponse>(404, "Pet not found")
  @Security("api_key")
  @Get("{petId}")
  public async getPetById(
    @Path() petId: number,
    @Res() notFound: TsoaResponse<404, ErrorResponse>,
  ): Promise<Pet | void> {
    const pet = petStore.getPet(petId);
    if (pet === undefined) {
      return notFound(404, { message: "Pet not found" });
    }

    return pet;
  }

  @Response<ErrorResponse>(404, "Pet not found")
  @Security("api_key")
  @Post("{petId}")
  public async updatePetWithForm(
    @Path() petId: number,
    @Query() name?: string,
    @Query() status?: PetStatus,
    @Res() notFound: TsoaResponse<404, ErrorResponse>,
  ): Promise<Record<string, never> | void> {
    const updated = petStore.updatePetFromForm(petId, name, status);
    if (!updated) {
      return notFound(404, { message: "Pet not found" });
    }

    return {};
  }

  @Response<ErrorResponse>(404, "Pet not found")
  @Security("api_key")
  @Delete("{petId}")
  public async deletePet(
    @Path() petId: number,
    @Res() notFound: TsoaResponse<404, ErrorResponse>,
  ): Promise<Record<string, never> | void> {
    if (!petStore.deletePet(petId)) {
      return notFound(404, { message: "Pet not found" });
    }

    return {};
  }

  @Response<ErrorResponse>(404, "Pet not found")
  @Security("api_key")
  @Post("{petId}/uploadImage")
  public async uploadPetImage(
    @Path() petId: number,
    @Request() request: any,
    @Query() additionalMetadata?: string,
    @Res() notFound: TsoaResponse<404, ErrorResponse>,
  ): Promise<ApiResponse | void> {
    const pet = petStore.getPet(petId);
    if (pet === undefined) {
      return notFound(404, { message: "Pet not found" });
    }

    const body = request.body;
    const length = Buffer.isBuffer(body) ? body.length : 0;

    return {
      code: 200,
      type: "unknown",
      message: `Uploaded ${length} bytes for pet ${petId}; metadata=${additionalMetadata ?? "none"}`,
    };
  }
}
