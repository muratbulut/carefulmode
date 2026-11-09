# Yayın testi: yayındaki migration imajına yarıda düşen (kendi içinde COMMIT olan) bir migration ekler.
#   docker buildx build --builder default --load --build-arg BASE=cyberguard-migrate:<sürüm> \
#     -t cyberguard-migrate:partial tests/deploy/partial-migration
# CI'daki Docker işi kullanır (ci.yml, "Yarım kalan migration'dan sonraki yayın").
ARG BASE
FROM ${BASE}
COPY --chown=node:node migration.sql prisma/migrations/29991231000001_partial_probe/migration.sql
