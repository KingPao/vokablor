# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY backend backend
COPY frontend frontend
RUN npm run build --workspace backend \
  && npm run build --workspace frontend

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package.json
RUN npm ci --omit=dev --workspace backend
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/frontend/dist frontend/dist
EXPOSE 3000
CMD ["node", "backend/dist/api/app.js"]
