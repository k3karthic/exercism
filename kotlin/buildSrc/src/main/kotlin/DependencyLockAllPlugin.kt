// https://github.com/antonioalmeida/gradle-multi-project-dependency-locking/blob/main/src/main/kotlin/io/github/antonioalmeida/lockall/DependencyLockAllPlugin.kt
package com.github.k3karthic.lockall

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.artifacts.ExternalModuleDependency

class DependencyLockAllPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        require(project == project.rootProject) {
            "dependency-lock-all plugin must be applied to the root project only, " + "but was applied to '${project.path}'"
        }

        // Each project resolves its own configurations in a task it owns, so Gradle holds that project's lock.
        val resolveTasks = project.rootProject.allprojects.map { subproject ->
            subproject.tasks.register("resolveDependencyLocks") {
                group = "dependency locking"
                description = "Resolves all configurations of this project to generate dependency lock files"
                doLast {
                    logger.lifecycle("Resolving configurations for project '${subproject.path}'")

                    subproject.configurations
                        .filter { it.isCanBeResolved }
                        .forEach { configuration ->
                            logger.info("  Resolving configuration '${configuration.name}'")
                            configuration.resolve()
                        }
                }
            }
        }

        project.tasks.register("writeDependencyLocks") {
            group = "dependency locking"
            description = "Resolves all configurations across all projects to generate dependency lock files"
            dependsOn(resolveTasks)
        }

        project.tasks.register("checkDependencyAge", CheckDependencyAgeTask::class.java) {
            group = "dependency locking"
            description = "Checks lockfiles and fails when direct dependencies have not been updated in 365 days"
            rootDirectory.set(project.layout.projectDirectory)
            lockfiles.from(
                project.rootProject.fileTree(project.rootDir).matching {
                    include("**/gradle.lockfile")
                    include("settings-gradle.lockfile")
                }
            )
        }

        project.gradle.projectsEvaluated {
            project.tasks.named("checkDependencyAge", CheckDependencyAgeTask::class.java).configure {
                directDependencies.set(collectDirectDependencies(project))
            }
        }
    }
}

private fun collectDirectDependencies(project: Project): Set<String> {
    val dependencies = linkedSetOf<String>()

    project.rootProject.allprojects.forEach { subproject ->
        subproject.configurations.forEach { configuration ->
            configuration.dependencies.withType(ExternalModuleDependency::class.java).forEach { dependency ->
                val group = dependency.group?.takeIf(String::isNotBlank) ?: return@forEach
                val name = dependency.name.takeIf(String::isNotBlank) ?: return@forEach
                val version = dependency.versionConstraint.requiredVersion.takeIf(String::isNotBlank)
                    ?: return@forEach

                dependencies += "$group:$name:$version"
            }
        }
    }

    return dependencies
}
