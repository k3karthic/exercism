import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import type {
  Category,
  OrderStatus,
  PetStatus,
  Tag,
} from "./generated/client/models/index.ts";

export const pets = pgTable("pet", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  photoUrls: jsonb("photo_urls").$type<string[]>().notNull().default([]),
  category: jsonb("category").$type<Category>(),
  tags: jsonb("tags").$type<Tag[]>().notNull().default([]),
  status: text("status").$type<PetStatus>(),
});

export const orders = pgTable("order", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id"),
  quantity: integer("quantity"),
  shipDate: timestamp("ship_date", { withTimezone: true, mode: "date" }),
  status: varchar("status", { length: 20 }).$type<OrderStatus>(),
  complete: boolean("complete").notNull().default(false),
});

export const schema = { pets, orders };
