# School OS - API Dockerfile
# Build context is the repository root (monorepo).
FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@10.33.2

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY services/api/package.json services/api/tsconfig.json ./services/api/
COPY packages/*/package.json packages/*/tsconfig.json ./packages/
RUN pnpm install --frozen-lockfile --filter school-os-api...

FROM deps AS prisma-generate
COPY services/api/prisma ./services/api/prisma
RUN cd services/api && pnpm prisma generate

FROM prisma-generate AS builder
COPY services/api/src ./services/api/src
COPY packages/*/src ./packages/
WORKDIR /app/services/api
RUN pnpm build

FROM base AS runner
WORKDIR /app/services/api
COPY --from=builder /app/services/api/dist ./dist
COPY --from=prisma-generate /app/services/api/prisma ./prisma
COPY --from=deps /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/server.js"]
