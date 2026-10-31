// The code in this file is a convention plugin - a Gradle mechanism for sharing reusable build logic.
// `buildSrc` is a Gradle-recognized directory and every plugin there will be easily available in the rest of the build.
@file:Suppress("PackageDirectoryMismatch")
package buildsrc.convention

import org.gradle.api.tasks.testing.logging.TestLogEvent

plugins {
    // Apply the Kotlin JVM plugin to add support for Kotlin in JVM projects.
    kotlin("jvm")
    id("org.jetbrains.kotlinx.rpc.plugin")
    id("org.jlleitschuh.gradle.ktlint")
    id("dev.detekt")
    id("org.jetbrains.kotlinx.kover")
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

// Centralize the dependency overrides used by the application modules so they stay consistent.
configurations.all {
    resolutionStrategy.eachDependency {
        if (requested.group == "ch.qos.logback") {
            useVersion("1.5.34")
            because("CVE-2024-12798, CVE-2025-11226, CVE-2024-12801, CVE-2026-1225, CVE-2026-9828, CVE-2026-10532")
        }
        if (requested.group == "io.netty") {
            useVersion("4.2.17.Final")
            because("GHSA-mfg7-5gfp-c4w3, CVE-2026-44249, CVE-2026-45674, CVE-2026-47691, CVE-2026-45673, CVE-2026-75595, CVE-2026-75596")
        }
        if (requested.group == "at.yawk.lz4" && requested.name == "lz4-java") {
            useVersion("1.11.4")
            because("CVE-2026-59949, CVE-2026-106449, CVE-2026-106450, CVE-2026-106451, CVE-2026-106452, CVE-2026-106453")
        }
        if (requested.group.startsWith("com.fasterxml.jackson")) {
            useVersion("2.18.11")
            because(
                "GHSA-r7wm-3cxj-wff9, GHSA-72hv-8253-57qq, CVE-2026-54512, CVE-2026-54513, CVE-2026-54514, CVE-2026-54515, CVE-2026-59888, CVE-2026-59889, GHSA-mhm7-754m-9p8w, CVE-2026-89407, CVE-2026-89425, CVE-2026-68497, CVE-2026-91776, CVE-2026-91777, CVE-2026-19032, CVE-2026-83557",
            )
        }
        if (requested.group == "com.google.guava" && requested.name == "guava" && requested.version?.endsWith("-jre") == true) {
            useVersion("33.7.2-jre")
            because("CVE-2026-102554: Denial of Service via unthrottled memory allocation during deserialization")
        }
        if (requested.group == "com.google.guava" && requested.name == "guava" && requested.version?.endsWith("-android") == true) {
            useVersion("33.7.2-android")
            because("CVE-2026-102554: Denial of Service via unthrottled memory allocation during deserialization")
        }
        if (requested.group == "org.xerial.snappy" && requested.name == "snappy-java") {
            useVersion("1.1.10.9")
            because("CVE-2026-108106, CVE-2026-93451, CVE-2026-116590")
        }
        if (requested.group == "io.micrometer") {
            useVersion("1.16.6")
            because("CVE-2026-40984: Micrometer Denial of Service via specially crafted HTTP requests")
        }
        if (requested.group == "net.minidev" && requested.name == "json-smart") {
            useVersion("2.5.2")
            because("CVE-2024-57699: DoS via stack exhaustion (incomplete fix for CVE-2023-1370)")
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

ktlint {
    filter {
        exclude { element ->
            element.file.path.contains("build/protoBuild") || element.file.path.contains("/generated/")
        }
    }
}

detekt {
    ignoreFailures = true
    buildUponDefaultConfig = true
    basePath.set(rootProject.layout.projectDirectory)
    config.setFrom(files(rootProject.file(".detekt.yml")))
}

tasks.withType<dev.detekt.gradle.Detekt>().configureEach {
    reports.sarif.required.set(true)
    finalizedBy(rootProject.tasks.named("detektReportMerge"))
}
