.PHONY: help install-dev test clean lint format fmt fmt-check check ci

help:
	@echo "Available targets:"
	@echo "  install-dev  - Install package in development mode with test dependencies"
	@echo "  test         - Run tests"
	@echo "  clean        - Clean build artifacts"
	@echo "  lint         - Run ruff linter"
	@echo "  fmt          - Format code with ruff"
	@echo "  fmt-check    - Check if code is properly formatted"
	@echo "  ci           - Run CI checks (lint + format check + tests)"
	@echo "  help         - Show this help message"

install-dev:
	pip install -e ".[test]"

test:
	python -m pytest

clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info/
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete

lint:
	python -m ruff check .

fmt:
	python -m ruff format .

fmt-check:
	python -m ruff format --check --diff .

ci: lint fmt-check test
