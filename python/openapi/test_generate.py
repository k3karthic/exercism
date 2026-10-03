from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from openapi import generate


def test_spec_uses_descriptive_schemas_for_records_and_empty_responses() -> None:
    spec = json.loads(generate.SPEC_PATH.read_text(encoding="utf-8"))
    schemas = spec["components"]["schemas"]

    assert {"Inventory", "ErrorDetails", "EmptyResponse"} <= schemas.keys()
    assert not any(name.startswith("Record_string.") for name in schemas)
    assert schemas["Inventory"]["additionalProperties"] == {"type": "integer"}
    assert schemas["ErrorDetails"]["additionalProperties"] is True
    assert schemas["EmptyResponse"]["additionalProperties"] is False

    responses = spec["paths"]
    assert (
        responses["/store/inventory"]["get"]["responses"]["200"]["content"][
            "application/json"
        ]["schema"]["$ref"]
        == "#/components/schemas/Inventory"
    )
    for operation in (
        responses["/pet/{petId}"]["post"],
        responses["/pet/{petId}"]["delete"],
        responses["/store/order/{orderId}"]["delete"],
    ):
        assert (
            operation["responses"]["200"]["content"]["application/json"]["schema"][
                "$ref"
            ]
            == "#/components/schemas/EmptyResponse"
        )


def test_generate_package_replaces_only_generated_target(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    target = tmp_path / "generated" / "server"
    target.mkdir(parents=True)
    (target / "old.py").write_text("old generated output", encoding="utf-8")
    handwritten = tmp_path / "client.py"
    handwritten.write_text("keep me", encoding="utf-8")

    def fake_run(
        command: list[str], check: bool, cwd: Path, env: dict[str, str]
    ) -> None:
        assert check
        assert cwd == generate.REPOSITORY_ROOT
        assert env["PWD"] == str(generate.REPOSITORY_ROOT)
        output = Path(command[command.index("--output") + 1])
        package = output / "openapi" / "generated" / "server"
        package.mkdir(parents=True)
        (package / "api.py").write_text("new generated output", encoding="utf-8")

    monkeypatch.setattr(generate.subprocess, "run", fake_run)

    generate._generate_package(
        generator="python-fastapi",
        package_name="openapi.generated.server",
        target=target,
        additional_properties={"sourceFolder": "."},
    )

    assert not (target / "old.py").exists()
    assert (target / "api.py").read_text(encoding="utf-8") == "new generated output"
    assert handwritten.read_text(encoding="utf-8") == "keep me"


def test_generate_package_keeps_previous_output_on_generator_failure(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    target = tmp_path / "generated" / "client"
    target.mkdir(parents=True)
    sentinel = target / "client.py"
    sentinel.write_text("existing output", encoding="utf-8")

    def fail_run(
        command: list[str], check: bool, cwd: Path, env: dict[str, str]
    ) -> None:
        raise subprocess.CalledProcessError(1, command)

    monkeypatch.setattr(generate.subprocess, "run", fail_run)

    with pytest.raises(subprocess.CalledProcessError):
        generate._generate_package(
            generator="python",
            package_name="openapi.generated.client",
            target=target,
            additional_properties={},
        )

    assert sentinel.read_text(encoding="utf-8") == "existing output"


def test_normalize_fastapi_query_types_preserves_path_validation(
    tmp_path: Path,
) -> None:
    apis = tmp_path / "apis"
    apis.mkdir()
    api_file = apis / "default_api.py"
    api_file.write_text(
        "limit: Annotated[int, Field(le=100, strict=True, ge=1)] = Query(20)\n"
        "offset: Annotated[int, Field(strict=True, ge=0)] = Query(0)\n"
        "page: Optional[StrictInt] = Query(1)\n"
        "pet_id: StrictInt = Path(...)\n",
        encoding="utf-8",
    )

    generate._normalize_fastapi_query_types(tmp_path)

    assert api_file.read_text(encoding="utf-8") == (
        "limit: Annotated[int, Field(le=100, ge=1)] = Query(20)\n"
        "offset: Annotated[int, Field(ge=0)] = Query(0)\n"
        "page: Optional[int] = Query(1)\n"
        "pet_id: StrictInt = Path(...)\n"
    )


def test_generate_validates_spec_and_configures_both_outputs(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    calls: list[list[str]] = []
    packages: list[dict[str, object]] = []
    monkeypatch.setattr(generate, "SPEC_PATH", tmp_path / "petstore.json")
    monkeypatch.setattr(generate, "GENERATED_ROOT", tmp_path / "generated")
    monkeypatch.setattr(
        generate.subprocess,
        "run",
        lambda command, check, cwd, env: calls.append(command),
    )
    monkeypatch.setattr(
        generate,
        "_generate_package",
        lambda **kwargs: packages.append(kwargs),
    )

    generate.generate()

    assert calls == [
        [
            "openapi-generator-cli",
            "validate",
            "--input-spec",
            str(tmp_path / "petstore.json"),
        ]
    ]
    assert [package["generator"] for package in packages] == [
        "python-fastapi",
        "python",
    ]
    assert [package["target"] for package in packages] == [
        tmp_path / "generated" / "server",
        tmp_path / "generated" / "client",
    ]
