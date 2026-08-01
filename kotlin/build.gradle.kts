plugins {
    id("com.github.k3karthic.lockall")
}

tasks.register<Exec>("scan") {
	commandLine(
        "trivy", "fs",
        "--scanners", "vuln,secret,misconfig",
        "--skip-files", "**/*.json",
        "."
    )
}
