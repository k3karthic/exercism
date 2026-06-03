export enum PetStatus {
  Available = "available",
  Pending = "pending",
  Sold = "sold",
}

export enum OrderStatus {
  Placed = "placed",
  Approved = "approved",
  Delivered = "delivered",
}

export interface Tag {
  id?: number;
  name?: string;
}

export interface Category {
  id?: number;
  name?: string;
}

export interface Pet {
  id?: number;
  name: string;
  photoUrls: string[];
  category?: Category;
  tags?: Tag[];
  status?: PetStatus;
}

export interface Order {
  id?: number;
  petId?: number;
  quantity?: number;
  shipDate?: string;
  status?: OrderStatus;
  complete?: boolean;
}

export interface ApiResponse {
  code?: number;
  type?: string;
  message?: string;
}

export interface ErrorResponse {
  message: string;
  details?: Record<string, unknown>;
}

export interface PetSearchCriteria {
  name?: string;
  status?: PetStatus[];
  tags?: string[];
  sortBy?: "name" | "status";
  sortOrder?: "asc" | "desc";
}

export interface PetSearchResults {
  results: Pet[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface DateRange {
  from?: string;
  to?: string;
}

export interface QuantityRange {
  min?: number;
  max?: number;
}

export interface OrderSearchCriteria {
  orderId?: number;
  petId?: number;
  status?: OrderStatus[];
  complete?: boolean;
  dateRange?: DateRange;
  quantityRange?: QuantityRange;
  sortBy?: "shipDate" | "petId" | "quantity" | "status" | "id";
  sortOrder?: "asc" | "desc";
}

export interface OrderSearchResults {
  orders: Order[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalResults: number;
  };
}
