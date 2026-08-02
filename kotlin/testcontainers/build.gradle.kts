plugins {
    // Apply the shared build logic from a convention plugin.
    // The shared code is located in `buildSrc/src/main/kotlin/kotlin-jvm.gradle.kts`.
    id("buildsrc.convention.kotlin-jvm")
    alias(libs.plugins.ktlint)

    // Apply the Application plugin to add support for building an executable JVM application.
    application
}

// Force netty to 4.2.16.Final to fix GHSA-mfg7-5gfp-c4w3 (netty-codec-dns memory leak),
// CVE-2026-44249 (netty-handler IPv6 bypass), CVE-2026-45674, CVE-2026-47691,
// CVE-2026-45673 (netty-resolver-dns). Netty 4.2.13.Final is pulled in transitively by lettuce.
configurations.all {
    resolutionStrategy.eachDependency {
        if (requested.group == "io.netty") {
            useVersion("4.2.16.Final")
            because("GHSA-mfg7-5gfp-c4w3, CVE-2026-44249, CVE-2026-45674, CVE-2026-47691, CVE-2026-45673")
        }
    }
}

dependencies {
    implementation(libs.kotlinxCoroutines)
    implementation(libs.kotlinxCoroutinesReactive)
    implementation(libs.lettuce)

    testImplementation(libs.kotlinxCoroutinesTest)
    testImplementation(platform(libs.testcontainersBom))
    testImplementation(libs.testcontainers)
    testImplementation(libs.testcontainersJunitJupiter)
    testImplementation(libs.testcontainersRedis)
    testImplementation(kotlin("test"))
}

application {
    // Define the Fully Qualified Name for the application main class
    // (Note that Kotlin compiles `App.kt` to a class with FQN `com.example.app.AppKt`.)
    mainClass = "com.github.k3karthic.testcontainers.MainKt"
}
