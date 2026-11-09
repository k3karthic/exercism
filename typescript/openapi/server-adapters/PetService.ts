import { and, count, eq, inArray, sql, type SQL } from "drizzle-orm";
import type {
  ErrorResponse,
  ModelApiResponse,
  Pet,
  PetSearchCriteria,
  PetSearchResults,
  PetStatus,
} from "../generated/client/models/index.ts";
import { getDatabase } from "../database.ts";
import { pets } from "../schema.ts";
import { sortValues } from "./utils.js";

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

function petFromRow(row: typeof pets.$inferSelect): Pet {
  return {
    id: row.id,
    name: row.name,
    photoUrls: [...row.photoUrls],
    ...(row.category === null ? {} : { category: { ...row.category } }),
    tags: row.tags.map((tag) => ({ ...tag })),
    ...(row.status === null ? {} : { status: row.status }),
  };
}

function petFilters(criteria: PetSearchCriteria): SQL | undefined {
  const filters: SQL[] = [];
  if (criteria.status !== undefined && criteria.status.length > 0) {
    filters.push(inArray(pets.status, criteria.status));
  }
  for (const tag of criteria.tags ?? []) {
    filters.push(sql`${pets.tags} @> ${JSON.stringify([{ name: tag }])}::jsonb`);
  }
  return filters.length === 0 ? undefined : and(...filters);
}

async function advancePetSequence(): Promise<void> {
  await getDatabase().execute(sql`
    SELECT setval(
      pg_get_serial_sequence('pet', 'id'),
      GREATEST(
        1,
        COALESCE(pg_sequence_last_value(pg_get_serial_sequence('pet', 'id')::regclass), 0),
        (SELECT COALESCE(MAX(id), 0) FROM pet)
      ),
      true
    )
  `);
}

export async function createPetDb(pet: Pet): Promise<Pet> {
  const values = {
    name: pet.name,
    photoUrls: pet.photoUrls,
    category: pet.category ?? null,
    tags: pet.tags ?? [],
    status: pet.status ?? null,
  };
  const insert = getDatabase()
    .insert(pets)
    .values(pet.id === undefined ? values : { ...values, id: pet.id });
  const [row] =
    pet.id === undefined
      ? await insert.returning()
      : await insert.onConflictDoUpdate({ target: pets.id, set: values }).returning();
  if (row === undefined) {
    throw new Error("Creating a pet did not return the inserted row");
  }
  if (pet.id !== undefined) {
    await advancePetSequence();
  }
  return petFromRow(row);
}

export async function updatePetDb(pet: Pet): Promise<Pet | undefined> {
  if (pet.id === undefined) return undefined;
  const [row] = await getDatabase()
    .update(pets)
    .set({
      name: pet.name,
      photoUrls: pet.photoUrls,
      category: pet.category ?? null,
      tags: pet.tags ?? [],
      status: pet.status ?? null,
    })
    .where(eq(pets.id, pet.id))
    .returning();
  return row === undefined ? undefined : petFromRow(row);
}

export async function getPet(petId: number): Promise<Pet | undefined> {
  const [row] = await getDatabase().select().from(pets).where(eq(pets.id, petId)).limit(1);
  return row === undefined ? undefined : petFromRow(row);
}

export async function deletePetDb(petId: number): Promise<boolean> {
  const deleted = await getDatabase().delete(pets).where(eq(pets.id, petId)).returning({ id: pets.id });
  return deleted.length > 0;
}

export async function updatePetFromFormDb(
  petId: number,
  name: string | undefined,
  status: PetStatus | undefined,
): Promise<boolean> {
  const values: { name?: string; status?: PetStatus | null } = {};
  if (name !== undefined) values.name = name;
  if (status !== undefined) values.status = status;
  if (Object.keys(values).length === 0) {
    return (await getPet(petId)) !== undefined;
  }
  const updated = await getDatabase().update(pets).set(values).where(eq(pets.id, petId)).returning({ id: pets.id });
  return updated.length > 0;
}

export async function findPetsByStatusDb(status: PetStatus): Promise<Pet[]> {
  const rows = await getDatabase().select().from(pets).where(eq(pets.status, status));
  return rows.map(petFromRow);
}

export async function findPetsByTagsDb(tags: string[]): Promise<Pet[]> {
  const filters = tags.map((tag) => sql`${pets.tags} @> ${JSON.stringify([{ name: tag }])}::jsonb`);
  const rows = await getDatabase()
    .select()
    .from(pets)
    .where(filters.length === 0 ? undefined : and(...filters));
  return rows.map(petFromRow);
}

export async function searchPetsDb(
  criteria: PetSearchCriteria,
  limit: number,
  offset: number,
): Promise<PetSearchResults> {
  const nameFilter = criteria.name?.replaceAll("*", "").toLowerCase();
  const matched = (await getDatabase().select().from(pets).where(petFilters(criteria)))
    .map(petFromRow)
    .filter((pet) => !nameFilter || pet.name.toLowerCase().includes(nameFilter));
  const sortBy = criteria.sortBy ?? "name";
  const sortField = sortBy === "status" ? "status" : "name";
  const sorted = sortValues(matched, sortField, criteria.sortOrder ?? "asc");
  const total = sorted.length;
  return {
    results: sorted.slice(offset, offset + limit),
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

export async function inventoryDb(): Promise<Record<string, number>> {
  const rows = await getDatabase().select({ status: pets.status, count: count() }).from(pets).groupBy(pets.status);
  const inventory: Record<string, number> = {};
  for (const row of rows) {
    if (row.status !== null) {
      inventory[row.status] = row.count;
    }
  }
  return inventory;
}

export async function addPet({ pet }: { pet: Pet }): Promise<Pet> {
  return createPetDb(pet);
}

export async function updatePet({ pet }: { pet: Pet }): Promise<Pet> {
  const updated = await updatePetDb(pet);
  if (updated === undefined) {
    throw new PetNotFoundError();
  }
  return updated;
}

export async function findPetsByStatus({ status }: { status?: PetStatus }): Promise<Pet[]> {
  return findPetsByStatusDb(status ?? ("available" as PetStatus));
}

export async function findPetsByTags({ tags }: { tags?: string | string[] }): Promise<Pet[]> {
  return findPetsByTagsDb(tagNames(tags));
}

export async function searchPets({ petSearchCriteria, limit, offset }: PetSearchRequest): Promise<PetSearchResults> {
  return searchPetsDb(petSearchCriteria, limit ?? 20, offset ?? 0);
}

export async function getPetById({ petId }: { petId: number }): Promise<Pet> {
  const pet = await getPet(petId);
  if (pet === undefined) {
    throw new PetNotFoundError();
  }
  return pet;
}

export async function updatePetWithForm({ petId, name, status }: UpdatePetFormRequest): Promise<Record<string, never>> {
  if (!(await updatePetFromFormDb(petId, name, status))) {
    throw new PetNotFoundError();
  }
  return {};
}

export async function deletePet({ petId }: { petId: number }): Promise<Record<string, never>> {
  if (!(await deletePetDb(petId))) {
    throw new PetNotFoundError();
  }
  return {};
}

export async function uploadPetImage({
  petId,
  additionalMetadata,
  body,
}: UploadPetImageRequest): Promise<ModelApiResponse> {
  if ((await getPet(petId)) === undefined) {
    throw new PetNotFoundError();
  }
  const length = body?.length ?? 0;
  return {
    code: 200,
    type: "unknown",
    message: `Uploaded ${length} bytes for pet ${petId}; metadata=${additionalMetadata ?? "none"}`,
  };
}
