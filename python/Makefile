.PHONY: format test

format:
	uv run ruff format .
	uv run ruff check --fix .

test:
	uv run pytest

scan:
	trivy fs --scanners vuln,secret,misconfig --skip-files "**/*.json" .
