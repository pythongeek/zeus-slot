FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production PORT=3000

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

RUN npm install --omit=dev

EXPOSE 3000

CMD ["node", "dist/boot.js"]
