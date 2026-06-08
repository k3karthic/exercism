from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Sequence

from openapi.server import app


def _build_command(
    *,
    source_flag: str,
    source_value: str,
    output_path: Path,
    meta: str,
    overwrite: bool,
    fail_on_warning: bool,
) -> list[str]:
    command = [
        "openapi-python-client",
        "generate",
        source_flag,
        source_value,
        "--output-path",
        str(output_path),
        "--meta",
        meta,
    ]
    if overwrite:
        command.append("--overwrite")
    if fail_on_warning:
        command.append("--fail-on-warning")
    return command


def _generate_from_schema_file(
    schema_path: Path,
    *,
    output_path: Path,
    meta: str,
    overwrite: bool,
    fail_on_warning: bool,
) -> None:
    command = _build_command(
        source_flag="--path",
        source_value=str(schema_path),
        output_path=output_path,
        meta=meta,
        overwrite=overwrite,
        fail_on_warning=fail_on_warning,
    )
    subprocess.run(command, check=True)


def generate_client(
    *,
    url: str | None = None,
    path: str | None = None,
    output_path: str | Path = Path("generated-client"),
    meta: str = "none",
    overwrite: bool = True,
    fail_on_warning: bool = False,
) -> None:
    if url and path:
        raise ValueError("Provide either url or path, not both.")

    output_dir = Path(output_path)
    if url is not None:
        command = _build_command(
            source_flag="--url",
            source_value=url,
            output_path=output_dir,
            meta=meta,
            overwrite=overwrite,
            fail_on_warning=fail_on_warning,
        )
        subprocess.run(command, check=True)
        return

    if path is not None:
        _generate_from_schema_file(
            Path(path),
            output_path=output_dir,
            meta=meta,
            overwrite=overwrite,
            fail_on_warning=fail_on_warning,
        )
        return

    schema = app.openapi()
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as temp_file:
        temp_path = Path(temp_file.name)
        json.dump(schema, temp_file)

    try:
        _generate_from_schema_file(
            temp_path,
            output_path=output_dir,
            meta=meta,
            overwrite=overwrite,
            fail_on_warning=fail_on_warning,
        )
    finally:
        temp_path.unlink(missing_ok=True)


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a typed client with openapi-python-client."
    )
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--url", help="OpenAPI document URL")
    source.add_argument("--path", help="OpenAPI document path")
    parser.add_argument(
        "--output-path",
        default="generated-client",
        help="Directory to write the generated client to.",
    )
    parser.add_argument(
        "--meta",
        default="none",
        choices=["none", "poetry", "setup", "pdm", "uv"],
        help="Metadata format for the generated client.",
    )
    parser.add_argument(
        "--overwrite",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Overwrite an existing client directory.",
    )
    parser.add_argument(
        "--fail-on-warning",
        action=argparse.BooleanOptionalAction,
        default=False,
        help="Treat generator warnings as errors.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    generate_client(
        url=args.url,
        path=args.path,
        output_path=args.output_path,
        meta=args.meta,
        overwrite=args.overwrite,
        fail_on_warning=args.fail_on_warning,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
