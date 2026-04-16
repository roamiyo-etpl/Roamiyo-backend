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

RUN npm run build && npm prune --omit=dev

# ---- Runtime ----
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
# Nest listens on SERVER_PORT (see config/configuration.ts); align EXPOSE with ingress.
ENV SERVER_PORT=5002

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 5002

CMD ["node", "dist/main.js"]
