.PHONY: format test check scan

format:
	uv run ruff format .
	uv run ruff check --fix .

test:
	uv run pytest

check:
	uv run python check_dependency_releases.py

scan:
	trivy fs --scanners vuln,secret,misconfig --skip-files "**/*.json" .
