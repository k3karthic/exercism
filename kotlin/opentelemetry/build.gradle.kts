plugins {
    // Apply the shared build logic from a convention plugin.
    // The shared code is located in `buildSrc/src/main/kotlin/kotlin-jvm.gradle.kts`.
    id("buildsrc.convention.kotlin-jvm")
    alias(libs.plugins.kotlinPluginSerialization)

    // Apply the Application plugin to add support for building an executable JVM application.
    application
}

dependencies {
    implementation(libs.bundles.otelInit)
    implementation(libs.bundles.otelInstrument)
    implementation(libs.kotlinxSerialization)

    testImplementation(kotlin("test"))
}

application {
    // Define the Fully Qualified Name for the application main class
    // (Note that Kotlin compiles `App.kt` to a class with FQN `com.example.app.AppKt`.)
    mainClass = "com.github.k3karthic.opentelemetry.MainKt"
}

kotlin.compilerOptions {
    optIn.add("io.opentelemetry.kotlin.ExperimentalApi")
}

tasks.named<JavaExec>("run") {
    environment("OTEL_EXPORTER_OTLP_ENDPOINT", System.getenv("OTEL_EXPORTER_OTLP_ENDPOINT") ?: "")
}

tasks.named<Test>("test") {
    environment("OTEL_NOOP", "true")
}
