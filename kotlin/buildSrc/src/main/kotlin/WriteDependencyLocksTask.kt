// https://github.com/antonioalmeida/gradle-multi-project-dependency-locking/blob/main/src/main/kotlin/io/github/antonioalmeida/lockall/WriteDependencyLocksTask.kt
package com.github.k3karthic.lockall

import org.gradle.api.DefaultTask
import org.gradle.api.tasks.TaskAction

abstract class WriteDependencyLocksTask : DefaultTask() {

    init {
        // Mark the task incompatible so Gradle safely bypasses the cache for this run
        notCompatibleWithConfigurationCache("Filters and resolves configurations at execution time to generate lockfiles.")
    }

    @TaskAction
    fun resolveAll() {
        project.rootProject.allprojects.forEach { subproject ->
            logger.lifecycle("Resolving configurations for project '${subproject.path}'")

            subproject.configurations
                .filter { it.isCanBeResolved }
                .forEach { configuration ->
                    try {
                        logger.info("  Resolving configuration '${configuration.name}'")
                        configuration.resolve()
                    } catch (e: Exception) {
                        logger.info(
                            "  Skipping configuration '${configuration.name}': ${e.message}"
                        )
                    }
                }
        }
    }
}
