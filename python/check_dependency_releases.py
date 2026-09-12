#!/usr/bin/env python3
"""Flag pyproject.toml dependencies that have not had a release in 365 days."""

from __future__ import annotations

import argparse
import datetime as dt
import re
import tomllib
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from packaging.requirements import InvalidRequirement, Requirement


@dataclass(frozen=True)
class Dependency:
    source: str
    requirement: str


@dataclass(frozen=True)
class CheckResult:
    name: str
    source: str
    latest_version: str | None
    latest_release: dt.datetime | None
    status: str

    @property
    def age_days(self) -> int | None:
        if self.latest_release is None:
            return None
        delta = dt.datetime.now(dt.timezone.utc) - self.latest_release
        return int(delta.total_seconds() // 86400)


@dataclass(frozen=True)
class LockedPackage:
    name: str
    version: str
    latest_release: dt.datetime | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Flag dependencies in pyproject.toml that have not had a release "
            "within the last N days."
        )
    )
    parser.add_argument(
        "--pyproject",
        type=Path,
        default=Path("pyproject.toml"),
        help="Path to the pyproject.toml file to inspect.",
    )
    parser.add_argument(
        "--max-age-days",
        type=int,
        default=365,
        help="Maximum acceptable age in days for the latest release.",
    )
    return parser.parse_args()


def load_toml(path: Path) -> dict[str, Any]:
    with path.open("rb") as file:
        return tomllib.load(file)


def parse_timestamp(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def normalize_name(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def parse_requirement(requirement: str) -> Requirement | None:
    try:
        return Requirement(requirement)
    except InvalidRequirement:
        return None


def load_uv_lock(path: Path) -> dict[str, LockedPackage]:
    lock = load_toml(path)
    packages: dict[str, LockedPackage] = {}

    for package in lock.get("package", []):
        release_candidates: list[dt.datetime] = []
        sdist = package.get("sdist")
        if sdist is not None:
            release = parse_timestamp(sdist.get("upload-time"))
            if release is not None:
                release_candidates.append(release)

        for wheel in package.get("wheels", []):
            release = parse_timestamp(wheel.get("upload-time"))
            if release is not None:
                release_candidates.append(release)

        packages[normalize_name(package["name"])] = LockedPackage(
            name=package["name"],
            version=package["version"],
            latest_release=max(release_candidates) if release_candidates else None,
        )

    return packages


def collect_dependencies(pyproject: dict[str, Any]) -> list[Dependency]:
    dependencies: list[Dependency] = []

    project = pyproject.get("project", {})
    for requirement in project.get("dependencies", []):
        dependencies.append(Dependency("project.dependencies", requirement))

    for group_name, group_requirements in project.get(
        "optional-dependencies", {}
    ).items():
        for requirement in group_requirements:
            dependencies.append(
                Dependency(f"project.optional-dependencies.{group_name}", requirement)
            )

    for group_name, group_requirements in pyproject.get(
        "dependency-groups", {}
    ).items():
        for requirement in group_requirements:
            dependencies.append(
                Dependency(f"dependency-groups.{group_name}", requirement)
            )

    return dependencies


def lookup_locked_package(
    lock_packages: dict[str, LockedPackage], requirement_name: str
) -> LockedPackage | None:
    return lock_packages.get(normalize_name(requirement_name))


def check_dependency(
    dependency: Dependency,
    cache: dict[str, tuple[str | None, dt.datetime | None, str]],
    lock_packages: dict[str, LockedPackage],
) -> CheckResult:
    requirement = parse_requirement(dependency.requirement)
    if requirement is None:
        return CheckResult(
            name=dependency.requirement,
            source=dependency.source,
            latest_version=None,
            latest_release=None,
            status="unparseable requirement",
        )

    if requirement.url:
        return CheckResult(
            name=requirement.name,
            source=dependency.source,
            latest_version=None,
            latest_release=None,
            status="direct reference; skipped",
        )

    normalized_name = normalize_name(requirement.name)
    if normalized_name in cache:
        latest_version, latest_release, status = cache[normalized_name]
        return CheckResult(
            name=requirement.name,
            source=dependency.source,
            latest_version=latest_version,
            latest_release=latest_release,
            status=status,
        )

    locked_package = lookup_locked_package(lock_packages, requirement.name)
    if locked_package is None:
        status = "missing from uv.lock"
        cache[normalized_name] = (None, None, status)
        return CheckResult(
            name=requirement.name,
            source=dependency.source,
            latest_version=None,
            latest_release=None,
            status=status,
        )

    status = (
        "ok"
        if locked_package.latest_release is not None
        else "missing release timestamp in uv.lock"
    )
    cache[normalized_name] = (
        locked_package.version,
        locked_package.latest_release,
        status,
    )
    return CheckResult(
        name=requirement.name,
        source=dependency.source,
        latest_version=locked_package.version,
        latest_release=locked_package.latest_release,
        status=status,
    )


def flag_stale_dependencies(
    results: Iterable[CheckResult], max_age_days: int
) -> tuple[list[CheckResult], list[CheckResult]]:
    stale: list[CheckResult] = []
    missing: list[CheckResult] = []

    for result in results:
        if result.status == "missing from uv.lock":
            missing.append(result)
            continue

        if result.status != "ok" or result.latest_release is None:
            continue

        if result.age_days is not None and result.age_days > max_age_days:
            stale.append(result)

    return stale, missing


def format_result(result: CheckResult) -> str:
    if result.latest_release is None:
        return f"{result.name} ({result.source}): {result.status}"

    age_days = result.age_days
    release_date = result.latest_release.date().isoformat()
    version = result.latest_version or "unknown"
    return (
        f"{result.name} ({result.source}): latest release {version} on "
        f"{release_date} ({age_days} days ago)"
    )


def main() -> int:
    args = parse_args()
    pyproject = load_toml(args.pyproject)
    lock_path = args.pyproject.with_name("uv.lock")
    lock_packages = load_uv_lock(lock_path)
    dependencies = collect_dependencies(pyproject)

    cache: dict[str, tuple[str | None, dt.datetime | None, str]] = {}
    results = [check_dependency(dep, cache, lock_packages) for dep in dependencies]
    stale, missing = flag_stale_dependencies(results, args.max_age_days)

    if missing:
        print(f"Found {len(missing)} dependency(s) missing from {lock_path.name}:")
        for result in missing:
            print(f"- {format_result(result)}")

    if stale:
        print(
            f"Found {len(stale)} dependency(s) without a release in the last "
            f"{args.max_age_days} days:"
        )
        for result in stale:
            print(f"- {format_result(result)}")

    if not missing and not stale:
        print(
            f"All {len(results)} dependencies have a release within the last "
            f"{args.max_age_days} days."
        )

    return 1 if missing or stale else 0


if __name__ == "__main__":
    raise SystemExit(main())
