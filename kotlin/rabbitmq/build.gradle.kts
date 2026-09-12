plugins {
    // Apply the shared build logic from a convention plugin.
    // The shared code is located in `buildSrc/src/main/kotlin/kotlin-jvm.gradle.kts`.
    id("buildsrc.convention.kotlin-jvm")
    alias(libs.plugins.ktlint)

    // Apply the Application plugin to add support for building an executable JVM application.
    application
}

// Force netty to 4.2.17.Final to fix CVE-2026-75595 and CVE-2026-75596.
configurations.all {
    resolutionStrategy.eachDependency {
        if (requested.group == "io.netty") {
            useVersion("4.2.17.Final")
            because("CVE-2026-75595, CVE-2026-75596")
        }
    }
}

dependencies {
    implementation(libs.rabbitmq)

    testImplementation(platform(libs.testcontainersBom))
    testImplementation(libs.testcontainers)
    testImplementation(libs.testcontainersJunitJupiter)
    testImplementation(libs.testcontainersRabbitmq)
    testImplementation(kotlin("test"))
}

application {
    // Define the Fully Qualified Name for the application main class
    // (Note that Kotlin compiles `App.kt` to a class with FQN `com.example.app.AppKt`.)
    mainClass = "com.github.k3karthic.rabbitmq.MainKt"
}
