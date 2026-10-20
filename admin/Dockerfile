# AgriSmart admin dashboard (Next.js standalone server).
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN adduser -D -u 10001 agrismart
COPY --from=build --chown=agrismart /app/.next/standalone ./
COPY --from=build --chown=agrismart /app/.next/static ./.next/static
USER agrismart
EXPOSE 3000
CMD ["node", "server.js"]
