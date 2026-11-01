package com.github.k3karthic.openapi.db

import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.Table

object Categories : Table("categories") {
    val id = integer("id").autoIncrement()
    val name = varchar("name", 255).nullable()

    override val primaryKey = PrimaryKey(id)
}

object Tags : Table("tags") {
    val id = integer("id").autoIncrement()
    val name = varchar("name", 255).nullable()

    override val primaryKey = PrimaryKey(id)
}

object Pets : Table("pets") {
    val id = integer("id").autoIncrement()
    val name = varchar("name", 255)
    val categoryId = optReference("category_id", Categories.id, onDelete = ReferenceOption.SET_NULL)
    val status = varchar("status", 16).nullable()

    override val primaryKey = PrimaryKey(id)
}

object PetPhotoUrls : Table("pet_photo_urls") {
    val petId = reference("pet_id", Pets.id, onDelete = ReferenceOption.CASCADE)
    val url = varchar("url", 2048)
}

object PetTags : Table("pet_tags") {
    val petId = reference("pet_id", Pets.id, onDelete = ReferenceOption.CASCADE)
    val tagId = reference("tag_id", Tags.id, onDelete = ReferenceOption.CASCADE)

    override val primaryKey = PrimaryKey(petId, tagId)
}

object Orders : Table("orders") {
    val id = integer("id").autoIncrement()
    val petId = optReference("pet_id", Pets.id, onDelete = ReferenceOption.SET_NULL)
    val quantity = integer("quantity").nullable()
    val shipDate = varchar("ship_date", 64).nullable()
    val status = varchar("status", 16).nullable()
    val complete = bool("complete").nullable()

    override val primaryKey = PrimaryKey(id)
}

val allTables = arrayOf(Categories, Tags, Pets, PetPhotoUrls, PetTags, Orders)
