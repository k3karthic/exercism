import {
  OrderStatus,
  type Order,
  type OrderSearchCriteria,
  type OrderSearchResults,
  PetStatus,
  type Pet,
  type PetSearchCriteria,
  type PetSearchResults,
  type Tag,
} from "./models.js";

function clonePet(pet: Pet): Pet {
  return {
    ...pet,
    photoUrls: [...pet.photoUrls],
    tags: pet.tags?.map((tag) => ({ ...tag })),
    category: pet.category === undefined ? undefined : { ...pet.category },
  };
}

function cloneOrder(order: Order): Order {
  return { ...order };
}

function tagNames(tags: Tag[] | undefined): string[] {
  return (tags ?? [])
    .map((tag) => tag.name ?? "")
    .filter((name) => name.length > 0);
}

function sortValues<T>(values: T[], key: keyof T, order: "asc" | "desc"): T[] {
  const direction = order === "desc" ? -1 : 1;
  return [...values].sort((left, right) => {
    const leftValue = left[key];
    const rightValue = right[key];

    if (leftValue === rightValue) {
      return 0;
    }

    if (leftValue === undefined || leftValue === null) {
      return -direction;
    }

    if (rightValue === undefined || rightValue === null) {
      return direction;
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }

    return String(leftValue).localeCompare(String(rightValue)) * direction;
  });
}

export class PetStore {
  private nextPetId = 1;
  private nextOrderId = 1;

  private readonly pets = new Map<number, Pet>();
  private readonly orders = new Map<number, Order>();

  public reset(): void {
    this.nextPetId = 1;
    this.nextOrderId = 1;
    this.pets.clear();
    this.orders.clear();
  }

  public createPet(pet: Pet): Pet {
    const id = pet.id ?? this.nextPetId++;
    this.nextPetId = Math.max(this.nextPetId, id + 1);

    const stored: Pet = {
      ...clonePet(pet),
      id,
      tags: pet.tags?.map((tag) => ({ ...tag })) ?? [],
    };

    this.pets.set(id, stored);
    return clonePet(stored);
  }

  public updatePet(pet: Pet): Pet | undefined {
    if (pet.id === undefined) {
      return undefined;
    }

    const current = this.pets.get(pet.id);
    if (current === undefined) {
      return undefined;
    }

    const stored: Pet = {
      ...clonePet(pet),
      id: pet.id,
      tags: pet.tags?.map((tag) => ({ ...tag })) ?? [],
    };
    this.pets.set(pet.id, stored);
    return clonePet(stored);
  }

  public getPet(petId: number): Pet | undefined {
    const pet = this.pets.get(petId);
    return pet === undefined ? undefined : clonePet(pet);
  }

  public deletePet(petId: number): boolean {
    return this.pets.delete(petId);
  }

  public updatePetFromForm(
    petId: number,
    name: string | undefined,
    status: PetStatus | undefined,
  ): boolean {
    const pet = this.pets.get(petId);
    if (pet === undefined) {
      return false;
    }

    if (name !== undefined) {
      pet.name = name;
    }
    if (status !== undefined) {
      pet.status = status;
    }

    this.pets.set(petId, pet);
    return true;
  }

  public findPetsByStatus(status: PetStatus): Pet[] {
    return [...this.pets.values()]
      .filter((pet) => pet.status === status)
      .map((pet) => clonePet(pet));
  }

  public findPetsByTags(tags: string[]): Pet[] {
    return [...this.pets.values()]
      .filter((pet) => {
        const currentTags = tagNames(pet.tags);
        return tags.every((tag) => currentTags.includes(tag));
      })
      .map((pet) => clonePet(pet));
  }

  public searchPets(
    criteria: PetSearchCriteria,
    limit: number,
    offset: number,
  ): PetSearchResults {
    const nameFilter = criteria.name?.replaceAll("*", "").toLowerCase();
    const matched = [...this.pets.values()].filter((pet) => {
      if (nameFilter !== undefined && nameFilter.length > 0) {
        if (!pet.name.toLowerCase().includes(nameFilter)) {
          return false;
        }
      }

      if (
        criteria.status !== undefined &&
        criteria.status.length > 0 &&
        (pet.status === undefined || !criteria.status.includes(pet.status))
      ) {
        return false;
      }

      if (criteria.tags !== undefined && criteria.tags.length > 0) {
        const currentTags = tagNames(pet.tags);
        if (!criteria.tags.every((tag) => currentTags.includes(tag))) {
          return false;
        }
      }

      return true;
    });

    const sortBy = criteria.sortBy ?? "name";
    const sortField = sortBy === "status" ? "status" : "name";
    const sorted = sortValues(matched, sortField, criteria.sortOrder ?? "asc");
    const total = sorted.length;
    const paged = sorted
      .slice(offset, offset + limit)
      .map((pet) => clonePet(pet));

    return {
      results: paged,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  public inventory(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const pet of this.pets.values()) {
      if (pet.status === undefined) {
        continue;
      }

      counts[pet.status] = (counts[pet.status] ?? 0) + 1;
    }

    return counts;
  }

  public createOrder(order: Order): Order {
    const id = order.id ?? this.nextOrderId++;
    this.nextOrderId = Math.max(this.nextOrderId, id + 1);

    const stored: Order = {
      ...cloneOrder(order),
      id,
      complete: order.complete ?? false,
      shipDate: order.shipDate ?? new Date().toISOString(),
    };

    this.orders.set(id, stored);
    return cloneOrder(stored);
  }

  public getOrder(orderId: number): Order | undefined {
    const order = this.orders.get(orderId);
    return order === undefined ? undefined : cloneOrder(order);
  }

  public deleteOrder(orderId: number): boolean {
    return this.orders.delete(orderId);
  }

  public searchOrders(
    criteria: OrderSearchCriteria,
    page: number,
    pageSize: number,
  ): OrderSearchResults {
    const matched = [...this.orders.values()].filter((order) => {
      if (criteria.orderId !== undefined && order.id !== criteria.orderId) {
        return false;
      }

      if (criteria.petId !== undefined && order.petId !== criteria.petId) {
        return false;
      }

      if (
        criteria.status !== undefined &&
        criteria.status.length > 0 &&
        (order.status === undefined || !criteria.status.includes(order.status))
      ) {
        return false;
      }

      if (
        criteria.complete !== undefined &&
        order.complete !== criteria.complete
      ) {
        return false;
      }

      if (
        criteria.dateRange?.from !== undefined &&
        order.shipDate !== undefined
      ) {
        if (
          new Date(order.shipDate).getTime() <
          new Date(criteria.dateRange.from).getTime()
        ) {
          return false;
        }
      }

      if (
        criteria.dateRange?.to !== undefined &&
        order.shipDate !== undefined
      ) {
        if (
          new Date(order.shipDate).getTime() >
          new Date(criteria.dateRange.to).getTime()
        ) {
          return false;
        }
      }

      if (
        criteria.quantityRange?.min !== undefined &&
        (order.quantity ?? 0) < criteria.quantityRange.min
      ) {
        return false;
      }

      if (
        criteria.quantityRange?.max !== undefined &&
        (order.quantity ?? 0) > criteria.quantityRange.max
      ) {
        return false;
      }

      return true;
    });

    const sortBy = criteria.sortBy ?? "shipDate";
    const sortField =
      sortBy === "shipDate"
        ? "shipDate"
        : sortBy === "petId"
          ? "petId"
          : sortBy === "quantity"
            ? "quantity"
            : sortBy === "status"
              ? "status"
              : "id";
    const sorted = sortValues(matched, sortField, criteria.sortOrder ?? "desc");
    const totalResults = sorted.length;
    const start = (page - 1) * pageSize;
    const orders = sorted
      .slice(start, start + pageSize)
      .map((order) => cloneOrder(order));

    return {
      orders,
      pagination: {
        page,
        pageSize,
        totalPages: totalResults === 0 ? 0 : Math.ceil(totalResults / pageSize),
        totalResults,
      },
    };
  }
}

export const petStore = new PetStore();
