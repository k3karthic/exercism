package com.github.k3karthic.openapi

import com.github.k3karthic.openapi.db.DatabaseConfig
import com.github.k3karthic.openapi.db.runMigrations
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.swagger.swaggerUI
import io.ktor.server.resources.Resources
import io.ktor.server.routing.routing
import org.openapitools.server.AllApis
import org.openapitools.server.infrastructure.ApiKeyCredential
import org.openapitools.server.infrastructure.ApiKeyLocation
import org.openapitools.server.infrastructure.ApiPrincipal
import org.openapitools.server.infrastructure.AppDelegates
import org.openapitools.server.infrastructure.apiKeyAuth
import org.openapitools.server.infrastructure.delegates

fun Application.module() {
    runMigrations(DatabaseConfig.from(environment.config))

    install(Resources)
    install(ContentNegotiation) {
        json()
    }
    install(Authentication) {
        apiKeyAuth("api_key") {
            apiKeyName = "api_key"
            apiKeyLocation = ApiKeyLocation.HEADER
            validate { credentials: ApiKeyCredential ->
                ApiPrincipal(credentials)
            }
        }
    }

    delegates(
        AppDelegates(),
    )

    routing {
        swaggerUI(
            path = "docs",
            swaggerFile = "../../openapi/petstore.json",
        )
        AllApis()
    }
}
