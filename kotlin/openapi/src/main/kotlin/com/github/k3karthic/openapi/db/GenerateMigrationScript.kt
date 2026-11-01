@file:OptIn(ExperimentalDatabaseMigrationApi::class)

package com.github.k3karthic.openapi.db

import com.typesafe.config.ConfigFactory
import io.ktor.server.config.HoconApplicationConfig
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.core.ExperimentalDatabaseMigrationApi
import org.jetbrains.exposed.v1.migration.r2dbc.MigrationUtils
import org.jetbrains.exposed.v1.r2dbc.R2dbcDatabase
import org.jetbrains.exposed.v1.r2dbc.transactions.suspendTransaction
import java.io.File

private val versionPattern = Regex("^V(\\d+)__.*\\.sql$")

fun nextMigrationVersion(directory: File): Int =
    (
        directory
            .listFiles()
            .orEmpty()
            .mapNotNull {
                versionPattern
                    .find(it.name)
                    ?.groupValues
                    ?.get(1)
                    ?.toInt()
            }.maxOrNull() ?: 0
    ) + 1

@Suppress("SpreadOperator")
fun main(args: Array<String>) {
    val directory = File(args[0])
    val name = args[1].replace(Regex("\\W+"), "_")
    val config = DatabaseConfig.from(HoconApplicationConfig(ConfigFactory.load()))
    val scriptName = "V${nextMigrationVersion(directory)}__$name"

    val database = R2dbcDatabase.connect(config.r2dbcUrl, user = config.user, password = config.password)
    runBlocking {
        suspendTransaction(database) {
            MigrationUtils.generateMigrationScript(
                *allTables,
                scriptDirectory = directory.path,
                scriptName = scriptName,
            )
        }
    }
    println("Generated $directory/$scriptName.sql")
}
