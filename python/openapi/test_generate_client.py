from __future__ import annotations

from pathlib import Path

import pytest

from openapi.generate_client import DEFAULT_TEMPLATE_PATH, generate_client


def test_generate_client_uses_custom_template_path(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    commands: list[list[str]] = []

    def fake_run(command: list[str], check: bool) -> None:
        assert check is True
        commands.append(command)

    monkeypatch.setattr("openapi.generate_client.subprocess.run", fake_run)

    schema_path = tmp_path / "schema.json"
    schema_path.write_text("{}", encoding="utf-8")

    generate_client(path=schema_path, output_path=tmp_path)

    assert commands
    command = commands[0]
    assert "--custom-template-path" in command
    index = command.index("--custom-template-path")
    assert command[index + 1] == str(DEFAULT_TEMPLATE_PATH)
