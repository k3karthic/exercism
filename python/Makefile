.PHONY: format test coverage check scan vulture ruff lint

format:
	uv run ruff format .

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
	uv run ruff check --fix .

lint: ruff
