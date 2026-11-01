package com.github.k3karthic.openapi.db

import org.flywaydb.core.Flyway

const val MIGRATIONS_LOCATION = "classpath:db/migration"

// Flyway only supports JDBC, so JDBC is used here for applying migrations and nowhere else.
fun runMigrations(config: DatabaseConfig) {
    Flyway
        .configure()
        .dataSource(config.jdbcUrl, config.user, config.password)
        .locations(MIGRATIONS_LOCATION)
        .load()
        .migrate()
}
