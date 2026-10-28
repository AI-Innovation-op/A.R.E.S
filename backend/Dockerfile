FROM postgres:16-bookworm AS pgtools

FROM node:24-bookworm-slim AS frontend
WORKDIR /frontend
COPY packages/contracts /packages/contracts
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY packages/contracts /packages/contracts
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY database /database
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY packages/contracts /packages/contracts
COPY backend/package*.json ./
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 liblz4-1 libzstd1 libgssapi-krb5-2 git gh ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=pgtools /usr/lib/postgresql/16/bin/pg_dump /usr/local/bin/pg_dump
COPY --from=pgtools /usr/lib/postgresql/16/bin/pg_restore /usr/local/bin/pg_restore
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY backend/prompts ./prompts
COPY --from=build /database /database
COPY --from=frontend /frontend/dist ./public
COPY ESTADO-ACTUAL.md ficha_tecnica_maestra_ARES_v2.6.md LICENSE /
RUN mkdir -p /app/.local-setup/backups /app/.local-setup/settings && chown -R node:node /app/.local-setup
ENV ARES_SETTINGS_FILE=/app/.local-setup/settings/providers.env
USER node
EXPOSE 3000
CMD ["node", "dist/app.js"]
