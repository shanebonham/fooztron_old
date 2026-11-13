# syntax=docker/dockerfile:1.7
# Fooztron production image

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    FOOZTRON_PORT=4010 \
    FOOZTRON_DB=/data/fooztron.db
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json tsconfig.json ./
COPY src ./src
VOLUME ["/data"]
EXPOSE 4010
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:4010/api/health || exit 1
CMD ["npx", "tsx", "src/server/index.ts"]
