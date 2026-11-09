# Yayın testi: yayındaki migration imajına bilerek düşen bir migration ekler.
#   docker buildx build --builder default --load --build-arg BASE=cyberguard-migrate:<sürüm> \
#     -t cyberguard-migrate:failing tests/deploy/failing-migration
# CI'daki Docker işi ve docker/server/README.md ("Migration başarısız olursa") kullanır.
ARG BASE
FROM ${BASE}
COPY --chown=node:node migration.sql prisma/migrations/29991231000000_failing_probe/migration.sql
