from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import tempfile
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path

PACKAGE_ROOT = Path(__file__).parent
REPOSITORY_ROOT = PACKAGE_ROOT.parents[1]
SPEC_PATH = REPOSITORY_ROOT / "openapi" / "petstore.json"
OPENAPITOOLS_FILE = REPOSITORY_ROOT / "openapitools.json"
GENERATED_ROOT = PACKAGE_ROOT / "generated"
SERVER_TEMPLATES = PACKAGE_ROOT / "templates" / "server"


@dataclass
class GeneratorConfig:
    generator: str
    package_name: str
    target: Path
    additional_properties: dict[str, str]
    templates: Path | None = None
    postprocess: Callable[[Path], None] | None = None


def _run_generator(command: list[str]) -> None:
    environment = os.environ.copy()
    environment["PWD"] = str(REPOSITORY_ROOT)
    subprocess.run(command, check=True, cwd=REPOSITORY_ROOT, env=environment)


def _generate_package(config: GeneratorConfig) -> None:
    package_path = Path(*config.package_name.split("."))
    properties = ",".join(
        f"{key}={value}"
        for key, value in {
            "packageName": config.package_name,
            **config.additional_properties,
        }.items()
    )

    with tempfile.TemporaryDirectory(dir=config.target.parent) as temporary_directory:
        temporary_root = Path(temporary_directory)
        generator_output = temporary_root / "generator-output"

        command = [
            "openapi-generator-cli",
            "--openapitools",
            str(OPENAPITOOLS_FILE),
            "generate",
            "--generator-name",
            config.generator,
            "--input-spec",
            str(SPEC_PATH),
            "--output",
            str(generator_output),
            "--additional-properties",
            properties,
        ]
        if config.templates is not None:
            command.extend(["--template-dir", str(config.templates)])

        _run_generator(command)
        generated_package = generator_output / package_path
        if not generated_package.is_dir():
            raise FileNotFoundError(f"Generator did not produce the expected package: {generated_package}")

        staged_package = temporary_root / "staged-package"
        shutil.copytree(generated_package, staged_package)
        if config.postprocess is not None:
            config.postprocess(staged_package)
        backup = temporary_root / "previous-package"
        if config.target.exists():
            os.replace(config.target, backup)
        try:
            os.replace(staged_package, config.target)
        except OSError:
            if backup.exists():
                os.replace(backup, config.target)
            raise


def _normalize_fastapi_query_types(package: Path) -> None:
    """Replace StrictInt/StrictFloat with int/float in Query parameters.

    HTTP query parameters arrive as strings, so pydantic's StrictInt rejects
    valid inputs like "5". The python-fastapi generator uses StrictInt for
    integer/float query params, which causes 422 validation errors.
    Upstream fix: OpenAPITools/openapi-generator#24793 (remove when generator upgraded).
    """
    api_directory = package / "apis"
    for api_file in api_directory.glob("*_api.py"):
        lines = api_file.read_text(encoding="utf-8").splitlines(keepends=True)
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


def _remove_client_api_response_import(package: Path) -> None:
    """Remove the model ApiResponse import that shadows the framework ApiResponse class."""
    for api_file in package.rglob("*_api.py"):
        source = api_file.read_text(encoding="utf-8")
        source = source.replace(
            "from openapi.generated.client.models.api_response import ApiResponse\n",
            "",
        )
        api_file.write_text(source, encoding="utf-8")


def _normalize_fastapi_server(package: Path) -> None:
    _normalize_fastapi_query_types(package)


def _normalize_python_client(package: Path) -> None:
    _remove_client_api_response_import(package)


def generate() -> None:
    _run_generator(
        ["openapi-generator-cli", "--openapitools", str(OPENAPITOOLS_FILE), "validate", "--input-spec", str(SPEC_PATH)]
    )
    GENERATED_ROOT.mkdir(parents=True, exist_ok=True)

    _generate_package(
        GeneratorConfig(
            generator="python-fastapi",
            package_name="openapi.generated.server",
            target=GENERATED_ROOT / "server",
            additional_properties={
                "sourceFolder": ".",
                "fastapiImplementationPackage": "impl",
            },
            templates=SERVER_TEMPLATES,
            postprocess=_normalize_fastapi_server,
        )
    )
    _generate_package(
        GeneratorConfig(
            generator="python",
            package_name="openapi.generated.client",
            target=GENERATED_ROOT / "client",
            additional_properties={},
            postprocess=_normalize_python_client,
        )
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
