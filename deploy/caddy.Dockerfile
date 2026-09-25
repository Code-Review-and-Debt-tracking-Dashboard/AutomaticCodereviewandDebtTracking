# Build from the repo root: docker build -f deploy/caddy.Dockerfile .
FROM node:20-trixie-slim AS web
WORKDIR /app

# every workspace package.json, or npm ci rejects the lockfile
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY apps/worker/package.json apps/worker/
COPY packages ./packages
# web's tsconfig needs the jest-dom types from the root devDependencies.
# the build never runs puppeteer, so skip its chrome download
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci -w web --include-workspace-root

COPY apps/web ./apps/web
# vite bakes this into the bundle, so it has to be set at build time
ARG VITE_API_URL
RUN npm run build -w web

FROM caddy:2.11-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web /app/apps/web/dist /srv/web
