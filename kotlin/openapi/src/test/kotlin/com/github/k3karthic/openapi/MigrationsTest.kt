@file:OptIn(ExperimentalDatabaseMigrationApi::class)

package com.github.k3karthic.openapi

import com.github.k3karthic.openapi.db.DatabaseConfig
import com.github.k3karthic.openapi.db.allTables
import com.github.k3karthic.openapi.db.runMigrations
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.core.ExperimentalDatabaseMigrationApi
import org.jetbrains.exposed.v1.migration.r2dbc.MigrationUtils
import org.jetbrains.exposed.v1.r2dbc.R2dbcDatabase
import org.jetbrains.exposed.v1.r2dbc.transactions.suspendTransaction
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer
import kotlin.test.Test
import kotlin.test.assertTrue

@Testcontainers
class MigrationsTest {
    companion object {
        @Container
        @JvmField
        val postgres = PostgreSQLContainer("postgres:17-alpine")
    }

    @Test
    fun migrationsMatchExposedTables() {
        val config =
            DatabaseConfig(
                jdbcUrl = postgres.jdbcUrl,
                r2dbcUrl = "r2dbc:postgresql://${postgres.host}:${postgres.firstMappedPort}/${postgres.databaseName}",
                user = postgres.username,
                password = postgres.password,
            )
        runMigrations(config)

        val database = R2dbcDatabase.connect(config.r2dbcUrl, user = config.user, password = config.password)
        val statements =
            runBlocking {
                suspendTransaction(database) {
                    MigrationUtils.statementsRequiredForDatabaseMigration(*allTables)
                }
            }
        assertTrue(statements.isEmpty(), "Migrations are out of sync with tables: $statements")
    }
}
