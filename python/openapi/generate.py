from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import tempfile
from collections.abc import Callable, Sequence
from pathlib import Path

PACKAGE_ROOT = Path(__file__).parent
REPOSITORY_ROOT = PACKAGE_ROOT.parents[1]
SPEC_PATH = REPOSITORY_ROOT / "openapi" / "petstore.json"
GENERATED_ROOT = PACKAGE_ROOT / "generated"


def _run_generator(command: list[str]) -> None:
    environment = os.environ.copy()
    environment["PWD"] = str(REPOSITORY_ROOT)
    subprocess.run(command, check=True, cwd=REPOSITORY_ROOT, env=environment)


def _generate_package(
    *,
    generator: str,
    package_name: str,
    target: Path,
    additional_properties: dict[str, str],
    postprocess: Callable[[Path], None] | None = None,
) -> None:
    package_path = Path(*package_name.split("."))
    properties = ",".join(
        f"{key}={value}"
        for key, value in {
            "packageName": package_name,
            **additional_properties,
        }.items()
    )

    with tempfile.TemporaryDirectory(dir=target.parent) as temporary_directory:
        temporary_root = Path(temporary_directory)
        generator_output = temporary_root / "generator-output"
        _run_generator(
            [
                "openapi-generator-cli",
                "generate",
                "--generator-name",
                generator,
                "--input-spec",
                str(SPEC_PATH),
                "--output",
                str(generator_output),
                "--additional-properties",
                properties,
            ]
        )

        generated_package = generator_output / package_path
        if not generated_package.is_dir():
            raise FileNotFoundError(
                f"Generator did not produce the expected package: {generated_package}"
            )

        staged_package = temporary_root / "staged-package"
        shutil.copytree(generated_package, staged_package)
        if postprocess is not None:
            postprocess(staged_package)
        backup = temporary_root / "previous-package"
        if target.exists():
            os.replace(target, backup)
        try:
            os.replace(staged_package, target)
        except OSError:
            if backup.exists():
                os.replace(backup, target)
            raise


def _normalize_fastapi_query_types(package: Path) -> None:
    api_directory = package / "apis"
    for api_file in api_directory.glob("*_api.py"):
        lines = api_file.read_text(encoding="utf-8").splitlines(keepends=True)
        # HTTP query parameters arrive as strings, so generated strict ints reject valid inputs.
        normalized_lines = [
            line.replace("strict=True, ", "")
            .replace(", strict=True", "")
            .replace("strict=True", "")
            .replace("StrictInt", "int")
            .replace("StrictFloat", "float")
            if "= Query(" in line
            else line
            for line in lines
        ]
        api_file.write_text("".join(normalized_lines), encoding="utf-8")


def _remove_generated_import_conflicts(package: Path) -> None:
    for api_file in package.rglob("*_api.py"):
        source = api_file.read_text(encoding="utf-8")
        if api_file.parent.name == "api":
            source = source.replace(
                "from openapi.generated.client.models.api_response import ApiResponse\n",
                "",
            )
        elif api_file.parent.name == "apis":
            source = source.replace("    status,\n", "")
        api_file.write_text(source, encoding="utf-8")


def _normalize_generated_whitespace(package: Path) -> None:
    for generated_file in package.rglob("*.py"):
        lines = generated_file.read_text(encoding="utf-8").splitlines()
        generated_file.write_text(
            "\n".join(line.rstrip() for line in lines).rstrip() + "\n",
            encoding="utf-8",
        )


def _normalize_fastapi_server(package: Path) -> None:
    _normalize_fastapi_query_types(package)
    _remove_generated_import_conflicts(package)
    _normalize_generated_whitespace(package)


def _normalize_python_client(package: Path) -> None:
    _remove_generated_import_conflicts(package)
    _normalize_generated_whitespace(package)


def generate() -> None:
    _run_generator(
        ["openapi-generator-cli", "validate", "--input-spec", str(SPEC_PATH)]
    )
    GENERATED_ROOT.mkdir(parents=True, exist_ok=True)

    _generate_package(
        generator="python-fastapi",
        package_name="openapi.generated.server",
        target=GENERATED_ROOT / "server",
        additional_properties={
            "sourceFolder": ".",
            "fastapiImplementationPackage": "impl",
        },
        postprocess=_normalize_fastapi_server,
    )
    _generate_package(
        generator="python",
        package_name="openapi.generated.client",
        target=GENERATED_ROOT / "client",
        additional_properties={},
        postprocess=_normalize_python_client,
    )


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate isolated Python server and client packages from the OpenAPI spec."
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    _parse_args(argv)
    generate()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
