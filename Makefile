# Makefile: shortcuts for development, installation, linting, and Docker

.PHONY: install dev dev-backend dev-frontend docker-up docker-down lint

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

dev-backend:
	cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload

dev-frontend:
	cd frontend && npm run dev

dev:
	@echo "Starting AI Hub (backend + frontend concurrently)..."
	make dev-backend & make dev-frontend

docker-up:
	docker compose up --build

docker-down:
	docker compose down

lint:
	cd backend && ruff check . && mypy .
	cd frontend && npm run lint
