.PHONY: format test coverage check scan vulture ruff pylint lint

PYTHON_FILES := $(shell find . -type d \( -path './.venv' -o -path './.pytest_cache' -o -path './.ruff_cache' -o -path '*/__pycache__' -o -path './openapi/generated' -o -path './openapi/alembic/versions' \) -prune -o -type f -name '*.py' ! -name '*_pb2.py' ! -name '*_pb2_grpc.py' -print)
PYTHON_DIRS := $(sort $(dir $(PYTHON_FILES)))

format:
	uv run ruff format .
	uv run ruff check --fix .

test:
	uv run pytest -n auto --maxprocesses=8

coverage:
	mkdir -p coverage
	uv run pytest -n auto --maxprocesses=8 --cov \
		--cov-report=term-missing \
		--cov-report=json:coverage/coverage-final.json

check:
	uv run python check_dependency_releases.py

scan:
	trivy fs --scanners vuln,secret,misconfig --skip-files "**/*.json" .

vulture:
	uv run vulture . --exclude .venv,.pytest_cache,.ruff_cache,__pycache__,openapi/generated,openapi/alembic/versions,*_pb2.py,*_pb2_grpc.py

ruff:
	uv run ruff check .

pylint:
	@set -e; for dir in $(PYTHON_DIRS); do \
		files=$$(find "$$dir" -maxdepth 1 -type f -name '*.py' ! -name '*_pb2.py' ! -name '*_pb2_grpc.py' -print); \
		test -z "$$files" || \
		uv run pylint \
			--max-line-length=120 \
			--disable=typecheck,missing-module-docstring,missing-class-docstring,missing-function-docstring \
			--init-hook='import os, sys; sys.path.insert(0, os.getcwd()); sys.path.extend(["concurrency", "durable_execution", "grpc_exercise"])' \
			$$files; \
	done

lint: ruff pylint
