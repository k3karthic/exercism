val lockTasks = subprojects.map { subproject ->
	tasks.register<Exec>("lockDependencies_${subproject.name}") {
		commandLine(
			"./gradlew", "${subproject.name}:dependencies",
			"--write-locks", "-q"
		)
	}
}

val lockDependencies = tasks.register("lockDependencies") {
	dependsOn(lockTasks)
}

tasks.register<Exec>("scan") {
	dependsOn(lockDependencies)
	commandLine(
        "trivy", "fs",
        "--scanners", "vuln,secret,misconfig",
        "--skip-files", "**/*.json",
        "."
    )
}
