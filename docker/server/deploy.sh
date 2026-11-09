#!/usr/bin/env bash
# Yeni sürümü ayağa kaldırır; sağlıklı değilse bir öncekine döner.
#   bash docker/server/deploy.sh <sürüm> <alan-adı> <uygulama-portu>
# Sunucuda yayın iş akışı (.github/workflows/deploy.yml), CI'da Docker işi çağırır; ikisi
# de aynı betiği çalıştırır. Yayın klasörü bu betiğin iki üstüdür (sunucuda
# /opt/apps/cyberguard). .env ilk çalıştırmada orada üretilir ve oradan çıkmaz.

set -euo pipefail

VERSION=${1:?sürüm (commit) gerekli}
DOMAIN=${2:?alan adı gerekli}
APP_PORT=${3:?uygulama portu gerekli}
cd "$(dirname "$0")/../.."

# Kullanıcı docker grubunda değilse (sunucudaki gibi) docker şifresiz sudo ile çalışır.
if docker info > /dev/null 2>&1; then DOCKER=(docker); else DOCKER=(sudo -n docker); fi
# Sunucu düzeni: ana dosya + docker/server/compose.yml (Caddy yok, port yalnızca 127.0.0.1).
dc() { "${DOCKER[@]}" compose -f docker-compose.yml -f docker/server/compose.yml "$@"; }

# --- İlk kurulum: .env (veritabanı şifresi rastgele üretilir) ---------------------------
if [ ! -f .env ]; then
  echo "İlk kurulum: .env oluşturuluyor."
  (
    umask 077
    cat > .env <<ENV
# Sunucuda üretildi ($(date -u +%F)). Depoya girmez; yedeği güvenli bir yerde tutulmalı.
POSTGRES_USER=cyberguard
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=cyberguard
ENV
  )
fi

set_env() { # .env'de bir değeri değiştirir ya da ekler
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}

set_secret() { # gizli değeri yazar; değer hiçbir komutun argümanında görünmez (printf bash'in kendi komutu)
  local tmp
  tmp=$(mktemp .env.XXXXXX)
  grep -v "^$1=" .env > "$tmp" || true
  printf '%s=%s\n' "$1" "$2" >> "$tmp"
  mv "$tmp" .env
}

has_value() { grep -q "^$1=." .env; }

# Veritabanında tek bir SQL komutu (konteynerin içinde, yerel soketle; şifre gerekmez).
# shellcheck disable=SC2016 # $1 ve POSTGRES_* konteynerin içinde açılır
db_sql() { dc exec -T db sh -c 'psql -X -q -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' sh "$1"; }

# Prisma'nın "başarısız" saydığı migration'lar (bitmemiş ve geri alınmamış), satır satır. Hiç
# migration çalışmadıysa (tablo yok) boş. Veritabanı okunamazsa hata döner.
failed_migrations() {
  local exists
  exists=$(db_sql "SELECT to_regclass('public._prisma_migrations') IS NOT NULL") || return 1
  [ "$exists" = t ] || return 0
  db_sql "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY started_at"
}

# Şemanın parmak izi: yalnızca yapı (tablolar, sütunlar, kısıtlar, indeksler), veri değil.
# pg_dump'ın her çalışmada değişen \restrict satırları atılır.
# shellcheck disable=SC2016 # POSTGRES_* konteynerin içinde açılır
schema_fingerprint() {
  dc exec -T db sh -c 'pg_dump --schema-only --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
    | grep -vE '^\\(un)?restrict ' | sha256sum | cut -d' ' -f1
}

is_healthy() { # servisin (app ya da db) sağlık kontrolünü 3 dakikaya kadar bekler
  local state=""
  for _ in $(seq 1 90); do
    state=$(dc ps "$1" --format '{{.Health}}' 2> /dev/null || true)
    [ "$state" = "healthy" ] && return 0
    sleep 2
  done
  echo "$1 sağlıklı değil (durum: ${state:-yok})."
  return 1
}

# Türkçe adlı eski düzenden (SURUM, ALAN_ADI, UYGULAMA_PORTU; cyberguard-uygulama imajı;
# "veritabani" birimi) bir kez geçilir. Eski sürüme geri dönülemez: imaj adı ve veritabanı
# değişti. Eski veritabanı birimi silinmez, yerinde kalır.
if grep -q "^SURUM=" .env; then
  echo "Eski (Türkçe adlı) düzenden geçiliyor; bu yayında geri dönüş yok."
  sed -i -e '/^SURUM=/d' -e '/^ALAN_ADI=/d' -e '/^UYGULAMA_PORTU=/d' .env
fi

# --- Hesaplar (Faz 2) ------------------------------------------------------------------
# Oturum imzası sunucuda bir kez üretilir ve oradan çıkmaz (değişirse herkesin oturumu kapanır).
has_value BETTER_AUTH_SECRET || set_secret BETTER_AUTH_SECRET "$(openssl rand -hex 32)"
if [ "$DOMAIN" = localhost ]; then set_env BETTER_AUTH_URL "http://localhost:$APP_PORT"; else set_env BETTER_AUTH_URL "https://$DOMAIN"; fi
# Kod maillerinin gönderen adresi; Resend'de doğrulanan alan adında olmalı.
has_value MAIL_FROM_ADDRESS || set_env MAIL_FROM_ADDRESS "no-reply@$DOMAIN"
# Depo sırları (RESEND_API_KEY) ve depo değişkenleri (ADMIN_EMAILS) komut satırında değil,
# stdin'den "AD=değer" satırları olarak gelir (deploy.yml). Boş değer yazılmaz, sunucudaki eski
# değer kalır. Her değerin biçimi sıkı denetlenir (.env'e beklenmedik bir şey yazılmasın).
email='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
if [ ! -t 0 ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    name=${line%%=*}
    value=${line#*=}
    case "$name" in
      RESEND_API_KEY) pattern='^[A-Za-z0-9_-]+$' ;;
      # İlk yöneticiler (Faz 3): virgülle ayrılmış e-posta adresleri; virgül çevresindeki ve
      # baştaki/sondaki boşluklar atılır.
      ADMIN_EMAILS)
        value=$(printf '%s' "$value" | sed -E 's/[[:space:]]*,[[:space:]]*/,/g; s/^[[:space:]]+//; s/[[:space:]]+$//')
        pattern="^$email(,$email)*\$"
        ;;
      *) continue ;;
    esac
    [ -n "$value" ] || continue
    if [[ ! "$value" =~ $pattern ]]; then echo "$name biçimi geçersiz; yazılmadı."; exit 1; fi
    set_secret "$name" "$value"
    echo "$name güncellendi."
  done
fi
has_value RESEND_API_KEY || echo "Uyarı: RESEND_API_KEY yok; site kod maili gönderemez."
has_value ADMIN_EMAILS || echo "Uyarı: ADMIN_EMAILS yok; yönetim paneline girecek ilk yönetici atanamaz."

# --- Yayın öncesi yedek (Faz 6) ------------------------------------------------------------
# Veritabanı birimi zaten varsa (ilk kurulum değilse) migration'dan önce yedek alınır
# (backup.sh predeploy; en yeni 3'ü kalır). Burada henüz hiçbir şey değişmedi: .env'deki sürüm
# eski, çalışan konteynerler eski.
#
# Yedek alınamazsa yayın DURUR (iş kırmızı biter, çalışan sürüm olduğu gibi kalır). Gerekçe:
# migration veriyi geri dönülmez biçimde değiştirebilir (sütun ya da tablo silmek gibi); o anki
# yedek yoksa elde en çok bir gün eski gece yedeği kalır ve arada yazılan her şey kaybolabilir.
# Yayının gecikmesi ise siteyi düşürmez. Aynı sebep (disk dolu, veritabanı sağlıksız) çoğu zaman
# yayını da bozacağı için önce o düzeltilmeli. Çok acil bir durumda sunucuda elle atlanabilir:
#   SKIP_PREDEPLOY_BACKUP=1 bash docker/server/deploy.sh <sürüm> <alan-adı> <port>
project=${COMPOSE_PROJECT_NAME:-cyberguard}
db_volume=$("${DOCKER[@]}" volume ls -q --filter "label=com.docker.compose.project=$project" \
  --filter "label=com.docker.compose.volume=db-data")
SCHEMA_BEFORE=""
FAILED_BEFORE_CHECKED=no
if [ -z "$db_volume" ]; then
  echo "Veritabanı henüz yok (ilk kurulum); yayın öncesi yedek gerekmiyor."
else
  # Çalışan veritabanına dokunulmaz; durmuşsa yedek için başlatılır.
  if [ -z "$(dc ps -q --status running db)" ]; then dc up -d --no-build db; fi
  if ! is_healthy db; then
    echo "Veritabanı sağlıklı değil; yayın durduruldu. Çalışan sürüm değişmedi."
    exit 1
  fi
  # Önceki bir yayından kalan başarısız migration (güvenlik turu 5): aşağıdaki "Düşen migration"
  # yarım kalmış bir migration'ı işaretlemez ve siteyi kapalı bırakır. Biri onu elle düzeltmeden
  # yeni bir yayın gelirse şemanın yarım hali bu yayının "önceki hali" olur; parmak izi tutar ve
  # migration yanlışlıkla "geri alındı" diye işaretlenirdi (site yarım şemayla açılır, yayın öncesi
  # yedeğe dönmek veri kaybettirir hale gelirdi). Bu yüzden yayın burada, hiçbir şeye dokunmadan
  # durur: yedek alınmaz, migration işaretlenmez, konteynerler ve sürüm değişmez.
  if failed_before=$(failed_migrations); then
    FAILED_BEFORE_CHECKED=yes
    if [ -n "$failed_before" ]; then
      echo "Önceki bir yayından kalan başarısız migration var: $(paste -sd ' ' <<< "$failed_before")"
      echo "Yayın durduruldu; hiçbir şey değiştirilmedi (yedek alınmadı, migration işaretlenmedi, çalışan sürüm aynı)."
      echo "Yapılacak: docker/server/README.md, \"Migration başarısız olursa\" (elle)."
      exit 1
    fi
  fi
  if [ "${SKIP_PREDEPLOY_BACKUP:-}" = 1 ]; then
    echo "Uyarı: yayın öncesi yedek atlandı (SKIP_PREDEPLOY_BACKUP=1)."
  elif ! bash docker/server/backup.sh predeploy; then
    echo "Yayın öncesi yedek alınamadı; yayın durduruldu. Çalışan sürüm değişmedi."
    exit 1
  fi
  # Migration düşerse geri dönmeden önce şemanın değişmediği bununla denetlenir (aşağıda).
  SCHEMA_BEFORE=$(schema_fingerprint) || SCHEMA_BEFORE=""
fi

# --- Düşen migration (Faz 6) ---------------------------------------------------------------
# Yeni sürümün migration'ı düşerse Prisma _prisma_migrations'a "başarısız" bir satır yazar. O satır
# durdukça hiçbir "migrate deploy" çalışmaz (P3009): önceki sürüme dönülse de eski migration işi
# düşer, uygulama hiç başlamaz, site kapanır; sonraki yayınlar da aynı yerde takılır.
#
# PostgreSQL migration dosyasını tek bir örtük işlemde çalıştırır: dosyanın herhangi bir yerinde
# hata olursa o dosyanın bütün değişiklikleri geri alınır (bilerek düşen bir migration'la yerelde
# ve CI'da denendi: tests/deploy/failing-migration). Öyleyse migration "geri alındı" diye
# işaretlenir (prisma migrate resolve --rolled-back: yalnızca _prisma_migrations'taki satır
# değişir, veriye dokunulmaz) ve önceki sürüme dönülür. Düzeltilmiş migration bir sonraki yayında
# yeniden uygulanır.
#
# Güvence: şemanın parmak izi yayından önceki haliyle karşılaştırılır. Aynı değilse (migration
# kendi içinde COMMIT içeriyorsa ya da işlem dışında çalışan bir komut varsa yarım kalmış
# olabilir) hiçbir şey işaretlenmez, geri dönülmez ve veritabanına dokunulmaz. Yayın öncesi
# yedeğe dönmek gerekiyorsa elle yapılır (README, "Migration başarısız olursa"). Yayından önce
# başarısız migration olmadığı da okunmuş olmalıdır (yukarıda): işaretlenen satır yalnızca bu
# yayının migration'ı olabilir. Bu betik veritabanını hiçbir durumda silmez ya da üstüne yazmaz.
release_failed_migrations() {
  local failed names name current latest
  if ! failed=$(failed_migrations); then
    echo "Uyarı: migration durumu okunamadı."
    return 0
  fi
  [ -n "$failed" ] || return 0
  mapfile -t names <<< "$failed"
  echo "Başarısız migration: ${names[*]}"
  current=$(schema_fingerprint) || current=""
  if [ "$FAILED_BEFORE_CHECKED" != yes ] || [ -z "$SCHEMA_BEFORE" ] || [ -z "$current" ] || [ "$current" != "$SCHEMA_BEFORE" ]; then
    latest=$(find "${BACKUP_DIR:-/opt/backups/cyberguard}" -maxdepth 1 -name 'cyberguard-predeploy-*.dump' \
      -printf '%T@ %p\n' 2> /dev/null | sort -rn | sed -n '1s/^[^ ]* //p')
    if [ "$FAILED_BEFORE_CHECKED" != yes ] || [ -z "$SCHEMA_BEFORE" ] || [ -z "$current" ]; then
      echo "Şema yayından önceki haliyle karşılaştırılamadı (ilk kurulum ya da okunamadı)."
    else
      echo "Şema yayından önceki haliyle aynı değil: migration yarım kalmış olabilir."
    fi
    echo "Migration işaretlenmedi, veritabanına dokunulmadı; uygulama başlatılmadı (site kapalı)."
    echo "Yapılacak: docker/server/README.md, \"Migration başarısız olursa\". Yayın öncesi yedek: ${latest:-bulunamadı}"
    return 1
  fi
  echo "Şema yayından önceki haliyle aynı: migration'ın hiçbir değişikliği kalmamış."
  for name in "${names[@]}"; do
    if [[ ! "$name" =~ ^[0-9A-Za-z_]+$ ]]; then
      echo "Beklenmeyen migration adı: $name"
      return 1
    fi
    # Yeni sürümün migration imajıyla (migration dosyası onda); stdin kapalı.
    if ! dc run --rm --no-deps -T migrate ./node_modules/.bin/prisma migrate resolve --rolled-back "$name" < /dev/null; then
      echo "Migration geri alındı olarak işaretlenemedi: $name"
      return 1
    fi
  done
}

PREVIOUS=$(sed -n 's/^APP_VERSION=//p' .env)
echo "Önceki sürüm: ${PREVIOUS:-yok} · yeni sürüm: $VERSION"
set_env APP_VERSION "$VERSION"
set_env DOMAIN "$DOMAIN"
set_env APP_PORT "$APP_PORT"

if dc up -d --no-build --remove-orphans && is_healthy app; then
  echo "Yayında: $VERSION"
else
  dc ps -a || true
  dc logs --no-color --tail 80 migrate app || true
  if ! release_failed_migrations; then
    # .env önceki sürümü gösterir; README'deki elle adımların sonundaki "up" onu başlatır.
    if [ -n "$PREVIOUS" ]; then set_env APP_VERSION "$PREVIOUS"; fi
    echo ".env'deki sürüm: ${PREVIOUS:-yok} (başlatılmadı)."
    exit 1
  fi
  if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$VERSION" ]; then
    echo "Geri dönülüyor: $PREVIOUS"
    set_env APP_VERSION "$PREVIOUS"
    { dc up -d --no-build --remove-orphans && is_healthy app; } || true
  fi
  exit 1
fi

# Son üç sürümün imajları kalır (geri dönüş için), eskiler silinir. Eski adlı
# (cyberguard-uygulama) imajların hepsi silinir.
for name in cyberguard-app cyberguard-migrate; do
  "${DOCKER[@]}" image ls "$name" --format '{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' \
    | sort -r | tail -n +4 | cut -f2 | xargs -r "${DOCKER[@]}" image rm > /dev/null || true
done
"${DOCKER[@]}" image ls cyberguard-uygulama --format '{{.Repository}}:{{.Tag}}' \
  | xargs -r "${DOCKER[@]}" image rm > /dev/null || true
