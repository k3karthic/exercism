plugins {
    // Apply the shared build logic from a convention plugin.
    // The shared code is located in `buildSrc/src/main/kotlin/kotlin-jvm.gradle.kts`.
    id("buildsrc.convention.kotlin-jvm")
    alias(libs.plugins.ktlint)

    // Apply the Application plugin to add support for building an executable JVM application.
    application
}

// Force jackson to 2.18.9 to fix GHSA-r7wm-3cxj-wff9, GHSA-72hv-8253-57qq (jackson-core),
// CVE-2026-54512, CVE-2026-54513, CVE-2026-54514, CVE-2026-54515, CVE-2026-59888, CVE-2026-59889,
// GHSA-mhm7-754m-9p8w (jackson-databind). Jackson 2.15.4 is pulled in transitively by the Temporal SDK.
// Force json-smart to 2.5.2 to fix CVE-2024-57699 (DoS via stack exhaustion). Pulled in by Temporal SDK.
configurations.all {
    resolutionStrategy.eachDependency {
        if (requested.group.startsWith("com.fasterxml.jackson")) {
            useVersion("2.18.9")
            because("GHSA-r7wm-3cxj-wff9, GHSA-72hv-8253-57qq, CVE-2026-54512, CVE-2026-54513, CVE-2026-54514, CVE-2026-54515, CVE-2026-59888, CVE-2026-59889, GHSA-mhm7-754m-9p8w")
        }
        if (requested.group == "net.minidev" && requested.name == "json-smart") {
            useVersion("2.5.2")
            because("CVE-2024-57699: DoS via stack exhaustion (incomplete fix for CVE-2023-1370)")
        }
    }
}

dependencies {
    implementation(libs.bundles.temporal)

    testImplementation(kotlin("test"))
}

application {
    // Define the Fully Qualified Name for the application main class
    // (Note that Kotlin compiles `App.kt` to a class with FQN `com.example.app.AppKt`.)
    mainClass = "com.github.k3karthic.durableexecution.MainKt"
}
