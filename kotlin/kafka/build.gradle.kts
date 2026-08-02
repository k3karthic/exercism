plugins {
    // Apply the shared build logic from a convention plugin.
    // The shared code is located in `buildSrc/src/main/kotlin/kotlin-jvm.gradle.kts`.
    id("buildsrc.convention.kotlin-jvm")
    alias(libs.plugins.ktlint)

    // Apply the Application plugin to add support for building an executable JVM application.
    application
}

// Force lz4-java to 1.11.1 to fix CVE-2026-59949 (JVM crash via invalid input to native XXHash).
// lz4-java 1.10.2 is pulled in transitively by kafka-clients.
configurations.all {
    resolutionStrategy.eachDependency {
        if (requested.group == "at.yawk.lz4" && requested.name == "lz4-java") {
            useVersion("1.11.1")
            because("CVE-2026-59949: Native XXHash implementations can crash the JVM when passed invalid input")
        }
    }
}

dependencies {
    implementation(libs.kafka)

    testImplementation(platform(libs.testcontainersBom))
    testImplementation(libs.testcontainers)
    testImplementation(libs.testcontainersJunitJupiter)
    testImplementation(libs.testcontainersKafka)
    testImplementation(kotlin("test"))
}

application {
    // Define the Fully Qualified Name for the application main class
    // (Note that Kotlin compiles `App.kt` to a class with FQN `com.example.app.AppKt`.)
    mainClass = "com.github.k3karthic.kafka.MainKt"
}
