# Build from the repo root: docker build -f apps/worker/Dockerfile .
FROM node:20-trixie-slim

# git for cloning, python for pylint/bandit/radon, java for checkstyle/pmd
RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates curl unzip python3 python3-venv openjdk-21-jre-headless cppcheck \
    && rm -rf /var/lib/apt/lists/*

# debian blocks system-wide pip installs, so the python tools get their own venv
COPY apps/worker/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# the jars aren't in git, so fetch the same pinned versions the analyzers expect
RUN mkdir -p apps/worker/vendor \
 && curl -fsSL -o apps/worker/vendor/checkstyle-13.8.0-all.jar \
      https://github.com/checkstyle/checkstyle/releases/download/checkstyle-13.8.0/checkstyle-13.8.0-all.jar \
 && curl -fsSL -o /tmp/pmd.zip \
      https://github.com/pmd/pmd/releases/download/pmd_releases%2F7.27.0/pmd-dist-7.27.0-bin.zip \
 && unzip -q /tmp/pmd.zip -d apps/worker/vendor && rm /tmp/pmd.zip

# every workspace package.json, or npm ci rejects the lockfile
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY apps/worker/package.json apps/worker/
COPY packages ./packages
RUN npm ci -w @codehealth/worker && npm run generate -w packages/db

COPY apps/worker ./apps/worker

# set after npm ci so tsx (a devDependency) still installs
ENV NODE_ENV=production
USER node
WORKDIR /app/apps/worker
CMD ["../../node_modules/.bin/tsx", "src/index.ts"]
