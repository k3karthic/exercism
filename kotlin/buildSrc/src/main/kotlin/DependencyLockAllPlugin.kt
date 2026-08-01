// https://github.com/antonioalmeida/gradle-multi-project-dependency-locking/blob/main/src/main/kotlin/io/github/antonioalmeida/lockall/DependencyLockAllPlugin.kt
package com.github.k3karthic.lockall

import org.gradle.api.Plugin
import org.gradle.api.Project

class DependencyLockAllPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        require(project == project.rootProject) {
            "dependency-lock-all plugin must be applied to the root project only, " + "but was applied to '${project.path}'"
        }

        project.allprojects { dependencyLocking.lockAllConfigurations() }

        project.tasks.register("writeDependencyLocks", WriteDependencyLocksTask::class.java) {
            group = "dependency locking"
            description = "Resolves all configurations across all projects to generate dependency lock files"
        }
    }
}