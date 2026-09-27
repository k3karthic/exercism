import type {
  ErrorResponse,
  ModelApiResponse,
  Pet,
  PetSearchCriteria,
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

export function addPet({ pet }: { pet: Pet }): Pet {
  return petStore.createPet(pet);
}

export function updatePet({ pet }: { pet: Pet }): Pet {
  const updated = petStore.updatePet(pet);
  if (updated === undefined) {
    throw new PetNotFoundError();
  }
  return updated;
}

export function findPetsByStatus({
  status,
}: {
  status?: PetStatus;
}): Pet[] {
  return petStore.findPetsByStatus(status ?? ("available" as PetStatus));
}

export function findPetsByTags({ tags }: { tags?: string | string[] }): Pet[] {
  return petStore.findPetsByTags(tagNames(tags));
}

export function searchPets({
  petSearchCriteria,
  limit,
  offset,
}: PetSearchRequest) {
  return petStore.searchPets(petSearchCriteria, limit ?? 20, offset ?? 0);
}

export function getPetById({ petId }: { petId: number }): Pet {
  const pet = petStore.getPet(petId);
  if (pet === undefined) {
    throw new PetNotFoundError();
  }
  return pet;
}

export function updatePetWithForm({
  petId,
  name,
  status,
}: UpdatePetFormRequest): Record<string, never> {
  if (!petStore.updatePetFromForm(petId, name, status)) {
    throw new PetNotFoundError();
  }
  return {};
}

export function deletePet({ petId }: { petId: number }): Record<string, never> {
  if (!petStore.deletePet(petId)) {
    throw new PetNotFoundError();
  }
  return {};
}

export function uploadPetImage({
  petId,
  additionalMetadata,
  body,
}: UploadPetImageRequest): ModelApiResponse {
  if (petStore.getPet(petId) === undefined) {
    throw new PetNotFoundError();
  }
  const length = Buffer.isBuffer(body) ? body.length : body?.length ?? 0;
  return {
    code: 200,
    type: "unknown",
    message: `Uploaded ${length} bytes for pet ${petId}; metadata=${additionalMetadata ?? "none"}`,
  };
}
