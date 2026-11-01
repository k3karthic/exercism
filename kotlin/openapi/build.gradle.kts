plugins {
    // Apply the shared build logic from a convention plugin.
    // The shared code is located in `buildSrc/src/main/kotlin/kotlin-jvm.gradle.kts`.
    id("buildsrc.convention.kotlin-jvm")
    alias(libs.plugins.kotlinPluginSerialization)
    alias(ktorLibs.plugins.ktor)

    // Apply the Application plugin to add support for building an executable JVM application.
    application
}

dependencies {
    implementation(libs.kotlinxSerialization)

    implementation(ktorLibs.server.core)
    implementation(ktorLibs.server.autoHeadResponse)
    implementation(ktorLibs.server.defaultHeaders)
    implementation(ktorLibs.server.contentNegotiation)
    implementation(ktorLibs.server.auth)
    implementation(ktorLibs.server.metrics)
    implementation(ktorLibs.server.netty)
    implementation(ktorLibs.serialization.kotlinx.json)
    implementation(ktorLibs.server.resources)
    implementation(ktorLibs.server.hsts)
    implementation(ktorLibs.server.compression)
    implementation(ktorLibs.server.swagger)

    implementation(ktorLibs.client.core)
    implementation(ktorLibs.client.apache)
    implementation(ktorLibs.client.contentNegotiation)
    implementation(libs.bundles.moshi)

    implementation(exposedLibs.core)
    implementation(exposedLibs.r2dbc)
    implementation(exposedLibs.migration.core)
    implementation(exposedLibs.migration.r2dbc)
    implementation(libs.postgresql)
    implementation(libs.flyway)
    implementation(libs.flywayPostgresql)
    // JDBC is only used by Flyway to apply migrations, the application itself uses R2DBC
    runtimeOnly(libs.postgresqlJdbc)

    testImplementation(kotlin("test"))
    testImplementation(platform(libs.testcontainersBom))
    testImplementation(libs.testcontainers)
    testImplementation(libs.testcontainersJunitJupiter)
    testImplementation(libs.testcontainersPostgresql)
    testImplementation(ktorLibs.server.testHost)
}

application {
    mainClass = "io.ktor.server.netty.EngineMain"

    val isDevelopment: Boolean = project.ext.has("development")
    applicationDefaultJvmArgs = listOf("-Dio.ktor.development=$isDevelopment")
}

// OpenAPI Code Generation

val openApiGenerateClient =
    tasks.register<Exec>("openApiGenerateClient") {
        group = "openapi"
        description = "generate OpenAPI client stubs"

        val toolsJson =
            layout.projectDirectory
                .dir("../..")
                .file("openapitools.json")
                .asFile

        val outputDir =
            layout.buildDirectory
                .dir("openapi-gen/client")
                .get()
                .asFile
        workingDir = rootProject.layout.projectDirectory.asFile
        commandLine(
            "openapi-generator-cli",
            "--openapitools",
            toolsJson,
            "generate",
            "-g",
            "kotlin",
            "-o",
            outputDir.path,
            "-i",
            "../openapi/petstore.json",
            "--additional-properties",
            "library=jvm-ktor,enumPropertyNaming=UPPERCASE",
        )
    }

val openApiGenerateServer =
    tasks.register<Exec>("openApiGenerateServer") {
        group = "openapi"
        description = "generate OpenAPI server stubs"

        val toolsJson =
            layout.projectDirectory
                .dir("../..")
                .file("openapitools.json")
                .asFile

        val outputDir =
            layout.buildDirectory
                .dir("openapi-gen/server")
                .get()
                .asFile
        workingDir = rootProject.layout.projectDirectory.asFile
        commandLine(
            "openapi-generator-cli",
            "--openapitools",
            toolsJson,
            "generate",
            "-g",
            "kotlin-server",
            "-t",
            projectDir.resolve("templates").path,
            "-o",
            outputDir.path,
            "-i",
            "../openapi/petstore.json",
            "--additional-properties",
            "delegatePattern=true,enumPropertyNaming=UPPERCASE",
            "--type-mappings",
            "AnyType=JsonElement,object=JsonElement",
            "--import-mappings",
            "JsonElement=kotlinx.serialization.json.JsonElement",
        )
    }

val copyClientStubs =
    tasks.register<Copy>("copyClientStubs") {
        group = "openapi"
        description = "copy only src/main/kotlin from generated client into the OpenAPI source set"

        dependsOn(openApiGenerateClient)

        from(layout.buildDirectory.dir("openapi-gen/client/src/main/kotlin"))
        into(layout.buildDirectory.dir("generated-src/kotlin"))
    }

val copyServerStubs =
    tasks.register<Copy>("copyServerStubs") {
        group = "openapi"
        description = "copy only src/main/kotlin from generated server into the OpenAPI source set"

        dependsOn(openApiGenerateServer)

        from(layout.buildDirectory.dir("openapi-gen/server/src/main/kotlin"))
        into(layout.buildDirectory.dir("generated-src/kotlin"))
    }

val generateOpenApiStubs =
    tasks.register("generateOpenApiStubs") {
        group = "openapi"
        description = "generate and copy both client and server OpenAPI stubs"

        dependsOn(copyClientStubs, copyServerStubs)
    }

sourceSets {
    main {
        kotlin.srcDir(layout.buildDirectory.dir("generated-src/kotlin"))
    }
}

tasks.named("compileKotlin") {
    dependsOn(generateOpenApiStubs)
}

tasks.matching { it.name == "runKtlintCheckOverMainSourceSet" || it.name == "runKtlintFormatOverMainSourceSet" }.configureEach {
    dependsOn(generateOpenApiStubs)
}

// Database migrations

tasks.register<JavaExec>("generateMigrationScript") {
    group = "database"
    description =
        "generate a Flyway migration script by diffing the Exposed tables against the configured database " +
        "(pass -PmigrationName=<description>)"

    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "com.github.k3karthic.openapi.db.GenerateMigrationScriptKt"
    workingDir = projectDir
    args(
        layout.projectDirectory
            .dir("src/main/resources/db/migration")
            .asFile.path,
        providers.gradleProperty("migrationName").getOrElse("migration"),
    )
}
