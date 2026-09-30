# ==========================================
# TaxFlow NestJS API Production Dockerfile
# ==========================================
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm install --legacy-peer-deps

FROM base AS builder
WORKDIR /app
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
