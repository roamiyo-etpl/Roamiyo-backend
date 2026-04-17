# syntax=docker/dockerfile:1

# ---- Builder ----
FROM node:22-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

COPY package.json package-lock.json ./
# preinstall runs check-engine.js; it must exist before npm ci
COPY scripts ./scripts/

# Optional: pass from CI for private npm scopes — docker build --build-arg NPM_TOKEN=$NPM_TOKEN
ARG NPM_TOKEN
RUN if [ -n "$NPM_TOKEN" ]; then \
      printf '%s\n' "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc; \
    fi \
    && npm ci --no-audit --no-fund --loglevel=info \
    && rm -f .npmrc

COPY tsconfig.json ./
COPY . .
COPY json ./json

RUN npm run build && npm prune --omit=dev \
    && test -f json/currency.json && test -f json/airline_en.json && test -f json/airport_en.json

# ---- Runtime ----
FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/ ./
COPY --from=builder /app/json ./json
RUN mkdir -p /app/swagger \
    && test -f json/currency.json && test -f json/airline_en.json && test -f json/airport_en.json

CMD ["node", "dist/src/main.js"]
