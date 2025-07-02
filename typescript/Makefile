.PHONY: help install-dev test clean format fmt-check build ci

help:
	@echo "Available targets:"
	@echo "  install-dev  - Install dependencies"
	@echo "  test         - Run tests"
	@echo "  build        - Build TypeScript to JavaScript"
	@echo "  clean        - Clean build artifacts"
	@echo "  format       - Format code with Prettier"
	@echo "  fmt-check    - Check if code is properly formatted"
	@echo "  ci           - Run CI checks (format check + tests)"
	@echo "  help         - Show this help message"

install-dev:
	npm install

test:
	npm run test

build:
	npm run build

clean:
	npm run clean

format:
	npm run format

fmt-check:
	npm run format-check

ci: fmt-check test