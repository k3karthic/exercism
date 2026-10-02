.PHONY: format test check scan vulture

format:
	uv run ruff format .
	uv run ruff check --fix .

test:
	uv run pytest -n auto --maxprocesses=8

check:
	uv run python check_dependency_releases.py

scan:
	trivy fs --scanners vuln,secret,misconfig --skip-files "**/*.json" .

vulture:
	uv run vulture . --exclude .venv,.pytest_cache,.ruff_cache,__pycache__,openapi/generated,openapi/alembic/versions,*_pb2.py,*_pb2_grpc.py
