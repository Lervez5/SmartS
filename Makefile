DEV_COMPOSE=docker-compose -f docker-compose.dev.yml

.PHONY: dev
dev:
	$(DEV_COMPOSE) up --build

.PHONY: test
test:
	cd backend && pnpm test

.PHONY: db-push
db-push:
	cd backend && pnpm prisma db push


