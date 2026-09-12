## Notes

Testing is part of the standard Gradle subproject structure and does not have a dedicated module.

## Build & Run

This project uses [Gradle](https://gradle.org/).
To build and run the application, use the *Gradle* tool window by clicking the Gradle icon in the right-hand toolbar,
or run it directly from the terminal:

* Run `./gradlew run` to build and run the application.
* Run `./gradlew writeDependencyLocks --write-locks` to lock dependencies.
* Run `./gradlew checkDependencyAge` to check lockfiles and flag direct dependencies whose released versions are older than 365 days.
* Run `./gradlew ktlintFormat` to format Kotlin sources.
* Run `./gradlew build` to only build the application.
* Run `./gradlew check` to run all checks, including tests.
* Run `./gradlew clean` to clean all build outputs.

Note the usage of the Gradle Wrapper (`./gradlew`).
This is the suggested way to use Gradle in production projects.

[Learn more about the Gradle Wrapper](https://docs.gradle.org/current/userguide/gradle_wrapper.html).

[Learn more about Gradle tasks](https://docs.gradle.org/current/userguide/command_line_interface.html#common_tasks).

This project follows the suggested multi-module setup and consists of the `app` and `utils` subprojects.
The shared build logic was extracted to a convention plugin located in `buildSrc`.

This project uses a version catalog (see `gradle/libs.versions.toml`) to declare and version dependencies
and both a build cache and a configuration cache (see `gradle.properties`).

## Scan CVEs

```bash
./gradlew :scan
```

## Check dependency age

```bash
./gradlew checkDependencyAge
```

This task scans each `gradle.lockfile`, matches the direct dependencies declared by the build, and fails if any locked direct dependency version was released more than 365 days ago.
