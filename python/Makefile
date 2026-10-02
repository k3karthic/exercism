.PHONY: format test check scan vulture ruff pylint lint

PYTHON_FILES := $(shell find . -type d \( -path './.venv' -o -path './.pytest_cache' -o -path './.ruff_cache' -o -path '*/__pycache__' -o -path './openapi/generated' -o -path './openapi/alembic/versions' \) -prune -o -type f -name '*.py' ! -name '*_pb2.py' ! -name '*_pb2_grpc.py' -print)

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

ruff:
	uv run ruff check .

# Exercise READMEs replace boilerplate docstrings; parallel variants intentionally share code.
pylint:
	uv run pylint \
		--max-line-length=120 \
		--disable=typecheck,missing-module-docstring,missing-class-docstring,missing-function-docstring,duplicate-code \
		--init-hook='import sys; sys.path.extend(["concurrency", "durable_execution", "grpc_exercise"])' \
		$(PYTHON_FILES)

lint: ruff pylint
