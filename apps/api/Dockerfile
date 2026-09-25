# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:20-trixie-slim

# prisma migrate's engine needs openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# every workspace package.json, or npm ci rejects the lockfile
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY apps/worker/package.json apps/worker/
COPY packages ./packages
RUN npm ci -w @codehealth/api && npm run generate -w packages/db

COPY apps/api ./apps/api

# set after npm ci so tsx (a devDependency) still installs
ENV NODE_ENV=production
USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["../../node_modules/.bin/tsx", "src/index.ts"]
