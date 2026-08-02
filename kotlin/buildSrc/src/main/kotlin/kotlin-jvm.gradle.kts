// The code in this file is a convention plugin - a Gradle mechanism for sharing reusable build logic.
// `buildSrc` is a Gradle-recognized directory and every plugin there will be easily available in the rest of the build.
package buildsrc.convention

import org.gradle.api.tasks.testing.logging.TestLogEvent

plugins {
    // Apply the Kotlin JVM plugin to add support for Kotlin in JVM projects.
    kotlin("jvm")
}

kotlin {
    // Use a specific Java version to make it easier to work in different environments.
    jvmToolchain(25)
}

dependencyLocking {
    // Lock all resolvable configurations so dependency versions are reproducible across builds.
    lockAllConfigurations()
	lockMode = LockMode.STRICT
}

// Force logback to 1.5.34 to fix all known CVEs (CVE-2024-12798, CVE-2025-11226,
// CVE-2024-12801, CVE-2026-1225, CVE-2026-9828, CVE-2026-10532). Logback 1.3.14 is pulled
// in transitively by ktlint.
configurations.matching { it.name == "ktlint" }.configureEach {
    resolutionStrategy.eachDependency {
        if (requested.group == "ch.qos.logback") {
            useVersion("1.5.34")
            because("CVE-2024-12798, CVE-2025-11226, CVE-2024-12801, CVE-2026-1225, CVE-2026-9828, CVE-2026-10532")
        }
    }
}

tasks.withType<Test>().configureEach {
    // Configure all test Gradle tasks to use JUnitPlatform.
    useJUnitPlatform()

    // Log information about all test results, not only the failed ones.
    testLogging {
        events(
            TestLogEvent.FAILED,
            TestLogEvent.PASSED,
            TestLogEvent.SKIPPED
        )
    }
}
