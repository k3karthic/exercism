plugins {
    id("com.github.k3karthic.lockall")
    alias(libs.plugins.kover)
}

dependencies {
    subprojects.forEach { kover(project(it.path)) }
}

val generatedPackages = subprojects.flatMap { sub ->
    sub.fileTree(sub.projectDir) {
        include("**/generated/**/*.kt", "**/generated/**/*.java")
    }.mapNotNull { source ->
        Regex("(?m)^\\s*package\\s+([\\w.]+)")
            .find(source.readText())
            ?.groupValues
            ?.get(1)
    }
}.distinct()

kover {
    reports {
        filters {
            excludes {
                packages("com.github.k3karthic.app", "com.github.k3karthic.debugger", "com.github.k3karthic.utils")
                if (generatedPackages.isNotEmpty()) {
                    packages(*generatedPackages.toTypedArray())
                }
            }
        }
        verify {
            rule {
                minBound(70)
            }
        }
    }
}

tasks.register<dev.detekt.gradle.report.ReportMergeTask>("detektReportMerge") {
    output.set(layout.buildDirectory.file("reports/detekt/merge.sarif"))
    subprojects.forEach { sub ->
        sub.plugins.withId("dev.detekt") {
            val detektTasks = sub.tasks.withType<dev.detekt.gradle.Detekt>()
            input.from(detektTasks.map { it.reports.sarif.outputLocation })
            mustRunAfter(detektTasks)
        }
    }
}

tasks.register<Exec>("scan") {
	commandLine(
        "trivy", "fs",
        "--scanners", "vuln,secret,misconfig",
        "--skip-files", "**/*.json",
        "."
    )
}
