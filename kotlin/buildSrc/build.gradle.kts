plugins {
    // The Kotlin DSL plugin provides a convenient way to develop convention plugins.
    // Convention plugins are located in `src/main/kotlin`, with the file extension `.gradle.kts`,
    // and are applied in the project's `build.gradle.kts` files as required.
    `kotlin-dsl`
	`java-gradle-plugin`
}

kotlin {
    jvmToolchain(25)
}

dependencies {
    // Add a dependency on the Kotlin Gradle plugin, so that convention plugins can apply it.
    implementation(libs.kotlinGradlePlugin)
}

gradlePlugin {
	plugins {
		register("lockAllPlugin") {
			id = "com.github.k3karthic.lockall"
			implementationClass = "com.github.k3karthic.lockall.DependencyLockAllPlugin"
		}
	}
}
