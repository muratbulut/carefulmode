#!/usr/bin/env bash
# Örnek veriyi (demo) ekler ya da siler: prisma/demo.ts'i çalışan sürümün migration imajında
# çalıştırır (imajda prisma/ ve labs/ var; uygulamaya dokunulmaz, yeniden başlatılmaz).
#   printf '%s' "$DEMO_PASSWORD" | bash docker/server/demo-data.sh add
#   bash docker/server/demo-data.sh remove
# Yayın iş akışı (.github/workflows/deploy.yml) "demo-data" ve "demo-data-remove" işlemlerinde
# SSH ile çağırır; CI'da Docker işi aynı betiği dener. Giriş yapılabilen örnek hesapların şifresi
# (DEMO_PASSWORD) hiçbir komut satırına ve kayda girmez: stdin'den doğrudan betiğe geçer.
#
# Önce elle bir yedek alınır (backup.sh manual; en yeni 3'ü kalır). Yedek alınamazsa işlem durur.
# Ne eklendiği ve silindiği: prisma/demo-data.ts ve docker/server/README.md, "Örnek veri".

set -euo pipefail

ACTION=${1:-}
case "$ACTION" in
  add | remove) ;;
  *)
    echo "Kullanım: bash docker/server/demo-data.sh add|remove (add, şifreyi stdin'den okur)"
    exit 2
    ;;
esac
cd "$(dirname "$0")/../.."

if docker info > /dev/null 2>&1; then DOCKER=(docker); else DOCKER=(sudo -n docker); fi
dc() { "${DOCKER[@]}" compose -f docker-compose.yml -f docker/server/compose.yml "$@"; }

if [ ! -f .env ] || ! grep -q '^APP_VERSION=.' .env; then
  echo "Site henüz yayınlanmamış (.env ya da APP_VERSION yok)."
  exit 1
fi

# Yedek stdin'i (şifreyi) okumasın.
if ! bash docker/server/backup.sh manual < /dev/null; then
  echo "Yedek alınamadı; örnek veriye dokunulmadı."
  exit 1
fi

# Çalışan sürümün migration imajı; veritabanı zaten ayakta (--no-deps). stdin node'a geçer.
dc run --rm --no-deps -T migrate node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON prisma/demo.ts "$ACTION"
