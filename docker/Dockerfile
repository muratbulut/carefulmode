# syntax=docker/dockerfile:1
#
# Careful Mode imajı. Depo kökünden derlenir:
#   docker build -f docker/Dockerfile .                  -> runner (uygulama, varsayılan)
#   docker build -f docker/Dockerfile --target migrate . -> migrate (tek seferlik)
#
# runner : Next.js standalone sunucusu; yalnızca çalışmak için gereken dosyalar.
# migrate: prisma migrate deploy + başlangıç verisi. Prisma CLI'yi taşıdığı için
#          ayrı imajdır; uygulama imajını büyütmez.

ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1

# --- Bağımlılıklar -----------------------------------------------------------
FROM base AS deps
# Prisma şema motoru (migrate) imajdaki libssl.so.3'ü kullanır; ek paket gerekmez.
COPY package.json package-lock.json ./
# postinstall (prisma generate) şemayı ve ayarı ister.
COPY prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

# --- Derleme -----------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# public/ henüz yoksa da runner aşaması kopyalayabilsin.
RUN mkdir -p public \
 && npx prisma generate \
 && npm run build

# --- Migration bağımlılıkları -------------------------------------------------
# Migration işi yalnızca Prisma CLI'yi, Prisma istemcisini ve pg sürücüsünü ister. Tam
# bağımlılıklardan geri kalanı (Next.js, test araçları) budanır: imaj ~1,1 GB yerine
# ~350 MB olur. Sürümler kilit dosyasındakiyle aynı kalır, ağa çıkılmaz.
FROM deps AS migrate-deps
RUN node -e ' \
      const fs = require("fs"); \
      const p = require("./package.json"); \
      const hepsi = { ...p.dependencies, ...p.devDependencies }; \
      const gerekli = ["prisma", "@prisma/client", "@prisma/adapter-pg", "pg"]; \
      p.dependencies = Object.fromEntries(gerekli.map((ad) => [ad, hepsi[ad]])); \
      delete p.devDependencies; \
      delete p.scripts; \
      fs.writeFileSync("package.json", JSON.stringify(p)); \
    ' \
 && npm prune --omit=dev --offline --no-audit --no-fund

# --- Migration (tek seferlik iş) ----------------------------------------------
FROM base AS migrate
ENV NODE_ENV=production
COPY --from=migrate-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
# Örnek lablar (labs/examples/) ilk kurulumda veritabanına yüklenir.
COPY --chown=node:node labs ./labs
# Başlangıç verisi (prisma/seed.ts) üretilmiş istemciyi kullanır.
COPY --from=builder --chown=node:node /app/lib/generated ./lib/generated
USER node
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/prisma db seed"]

# --- Çalışma (varsayılan hedef) ------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Next.js .next/cache altına yazabildiği için dosyalar uygulama kullanıcısına aittir.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
