# Makefile for DevOps Template

.PHONY: help setup start stop restart logs test clean secrets

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Setup the project (copy .env.example, generate secrets)
	@echo "Setting up project..."
	@cp -n .env.example .env || true
	@$(MAKE) secrets

secrets: ## Generate secure secrets for .env file
	@echo "Generating secrets..."
	@echo "JWT_SECRET=$$(openssl rand -hex 32)" >> .env
	@echo "JWT_REFRESH_SECRET=$$(openssl rand -hex 32)" >> .env
	@echo "WEBHOOK_SECRET=$$(openssl rand -hex 32)" >> .env
	@echo "POSTGRES_PASSWORD=$$(openssl rand -hex 16)" >> .env
	@echo "DEFAULT_ADMIN_PASSWORD=$$(openssl rand -base64 12)" >> .env
	@echo "Secrets generated and added to .env file"

start-react: ## Start services with React frontend
	@echo "Starting services with React frontend..."
	@docker-compose --profile react up -d

start-html: ## Start services with HTML frontend
	@echo "Starting services with HTML frontend..."
	@docker-compose --profile html up -d

stop: ## Stop all services
	@echo "Stopping services..."
	@docker-compose down

restart: ## Restart all services
	@echo "Restarting services..."
	@docker-compose restart

logs: ## Show logs from all services
	@docker-compose logs -f

test: ## Run tests for all services
	@echo "Running tests for all services..."
	@cd services/auth && npm test
	@cd services/backend && npm test
	@cd services/payment && npm test
	@cd services/user && npm test

clean: ## Clean up containers, volumes, and images
	@echo "Cleaning up..."
	@docker-compose down -v
	@docker system prune -f

db-migrate: ## Run database migrations
	@echo "Running database migrations..."
	@docker-compose exec db psql -U $(shell grep POSTGRES_USER .env | cut -d '=' -f2) -d $(shell grep POSTGRES_DB .env | cut -d '=' -f2) -f /docker-entrypoint-initdb.d/001_initial_schema.sql

db-shell: ## Open a database shell
	@echo "Opening database shell..."
	@docker-compose exec db psql -U $(shell grep POSTGRES_USER .env | cut -d '=' -f2) -d $(shell grep POSTGRES_DB .env | cut -d '=' -f2)
