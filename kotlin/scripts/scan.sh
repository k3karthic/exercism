#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

mapfile -t subprojects < <(
    grep -oP '^include\("\K[^"]+' settings.gradle.kts | sed 's/^:*/:/'
)

if [ "${#subprojects[@]}" -eq 0 ]; then
    echo "No subprojects found in settings.gradle.kts" >&2
    exit 1
fi

lock_tasks=()
for project in "${subprojects[@]}"; do
    lock_tasks+=("${project}:dependencies")
done

echo "Locking dependencies for: ${subprojects[*]}"
./gradlew "${lock_tasks[@]}" --write-locks

echo "Running Trivy filesystem scan..."
trivy fs --scanners vuln,secret,misconfig --skip-files "**/*.json" .
