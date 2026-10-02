import type {
  ErrorResponse,
  ModelApiResponse,
  Pet,
  PetSearchCriteria,
  PetSearchResults,
  PetStatus,
} from "../generated/client/models/index.ts";
import { petStore } from "../store.ts";

class PetNotFoundError extends Error {
  public readonly code = 404;
  public readonly error: ErrorResponse;

  public constructor() {
    super("Pet not found");
    this.error = { message: this.message };
  }
}

interface PetSearchRequest {
  petSearchCriteria: PetSearchCriteria;
  limit?: number;
  offset?: number;
}

interface UpdatePetFormRequest {
  petId: number;
  name?: string;
  status?: PetStatus;
}

interface UploadPetImageRequest {
  petId: number;
  additionalMetadata?: string;
  body?: Buffer | string;
}

function tagNames(tags: string | string[] | undefined): string[] {
  if (tags === undefined) {
    return [];
  }
  return Array.isArray(tags) ? tags : [tags];
}

export async function addPet({ pet }: { pet: Pet }): Promise<Pet> {
  return petStore.createPet(pet);
}

export async function updatePet({ pet }: { pet: Pet }): Promise<Pet> {
  const updated = await petStore.updatePet(pet);
  if (updated === undefined) {
    throw new PetNotFoundError();
  }
  return updated;
}

export async function findPetsByStatus({ status }: { status?: PetStatus }): Promise<Pet[]> {
  return petStore.findPetsByStatus(status ?? ("available" as PetStatus));
}

export async function findPetsByTags({ tags }: { tags?: string | string[] }): Promise<Pet[]> {
  return petStore.findPetsByTags(tagNames(tags));
}

export async function searchPets({ petSearchCriteria, limit, offset }: PetSearchRequest): Promise<PetSearchResults> {
  return petStore.searchPets(petSearchCriteria, limit ?? 20, offset ?? 0);
}

export async function getPetById({ petId }: { petId: number }): Promise<Pet> {
  const pet = await petStore.getPet(petId);
  if (pet === undefined) {
    throw new PetNotFoundError();
  }
  return pet;
}

export async function updatePetWithForm({ petId, name, status }: UpdatePetFormRequest): Promise<Record<string, never>> {
  if (!(await petStore.updatePetFromForm(petId, name, status))) {
    throw new PetNotFoundError();
  }
  return {};
}

export async function deletePet({ petId }: { petId: number }): Promise<Record<string, never>> {
  if (!(await petStore.deletePet(petId))) {
    throw new PetNotFoundError();
  }
  return {};
}

export async function uploadPetImage({
  petId,
  additionalMetadata,
  body,
}: UploadPetImageRequest): Promise<ModelApiResponse> {
  if ((await petStore.getPet(petId)) === undefined) {
    throw new PetNotFoundError();
  }
  const length = Buffer.isBuffer(body) ? body.length : (body?.length ?? 0);
  return {
    code: 200,
    type: "unknown",
    message: `Uploaded ${length} bytes for pet ${petId}; metadata=${additionalMetadata ?? "none"}`,
  };
}
