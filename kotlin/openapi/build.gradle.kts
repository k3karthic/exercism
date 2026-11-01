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

    implementation(ktorLibs.client.core)
    implementation(ktorLibs.client.apache)
    implementation(ktorLibs.client.contentNegotiation)
    implementation(libs.bundles.moshi)

    testImplementation(kotlin("test"))
    testImplementation(ktorLibs.server.testHost)
}

application {
    // Define the Fully Qualified Name for the application main class
    // (Note that Kotlin compiles `App.kt` to a class with FQN `com.example.app.AppKt`.)
    mainClass = "com.github.k3karthic.openapi.MainKt"
}

// OpenAPI Code Generation

val openApiGenerateClient =
    tasks.register<Exec>("openApiGenerateClient") {
        group = "openapi"
        description = "generate OpenAPI client stubs"

        val outputDir =
            layout.buildDirectory
                .dir("openapi-gen/client")
                .get()
                .asFile
        workingDir = rootProject.layout.projectDirectory.asFile
        commandLine(
            "openapi-generator-cli",
            "--openapitools",
            "openapitools.json",
            "generate",
            "-g",
            "kotlin",
            "-o",
            outputDir.path,
            "-i",
            "../openapi/petstore.json",
            "--additional-properties",
            "library=jvm-ktor",
        )
    }

val openApiGenerateServer =
    tasks.register<Exec>("openApiGenerateServer") {
        group = "openapi"
        description = "generate OpenAPI server stubs"

        val outputDir =
            layout.buildDirectory
                .dir("openapi-gen/server")
                .get()
                .asFile
        workingDir = rootProject.layout.projectDirectory.asFile
        commandLine(
            "openapi-generator-cli",
            "--openapitools",
            "openapitools.json",
            "generate",
            "-g",
            "kotlin-server",
            "-o",
            outputDir.path,
            "-i",
            "../openapi/petstore.json",
            "--additional-properties",
            "delegatePattern=true"
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
