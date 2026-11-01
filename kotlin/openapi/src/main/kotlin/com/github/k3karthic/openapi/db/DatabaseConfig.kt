package com.github.k3karthic.openapi.db

import io.ktor.server.config.ApplicationConfig

data class DatabaseConfig(
    val jdbcUrl: String,
    val r2dbcUrl: String,
    val user: String,
    val password: String,
) {
    companion object {
        fun from(config: ApplicationConfig): DatabaseConfig =
            DatabaseConfig(
                jdbcUrl = config.property("db.jdbcUrl").getString(),
                r2dbcUrl = config.property("db.r2dbcUrl").getString(),
                user = config.property("db.user").getString(),
                password = config.property("db.password").getString(),
            )
    }
}
