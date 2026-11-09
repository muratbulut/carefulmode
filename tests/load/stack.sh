#!/usr/bin/env bash
# Yük testi için yerel üretim yığını ve araçları. Yığın sunucudakiyle aynı dosyalardan kurulur
# (docker-compose.yml + docker/server/compose.yml: uygulama 2 CPU / 1 GB, veritabanı 1,5 CPU /
# 1 GB) ve tests/load/compose.yml ile ayrı bir proje (cg-load) olarak 127.0.0.1:3205'te açılır.
# Canlı siteye ve sunucuya hiçbir istek atmaz.
#
#   bash tests/load/stack.sh build      imajları derle (cg-load-app:local, cg-load-migrate:local)
#   bash tests/load/stack.sh up         yığını başlat, sağlıklı olmasını bekle (migration + seed)
#   bash tests/load/stack.sh actions    çalışan derlemenin eylem kimlikleri -> tests/load/.data/actions.json
#   bash tests/load/stack.sh prepare [--students N --teachers N]   yük hesapları ve oturum çerezleri
#   bash tests/load/stack.sh k6 <betik.js> [k6 run seçenekleri]    k6'yı Docker'da koştur
#   bash tests/load/stack.sh school     okul-IP denemesi (school-ip.js; kod sunucusuyla)
#   bash tests/load/stack.sh cleanup    yük hesaplarını sil
#   bash tests/load/stack.sh stats-start | stats-stop   CPU ve bellek örnekleri (5 sn'de bir)
#   bash tests/load/stack.sh down       yığını ve veritabanını kaldır
#
# Ortam: LOAD_PORT (3205), LOAD_DB_PORT (15205), LOAD_OUTBOX_PORT (13205), LOAD_STATE_DIR
# (/tmp/cg-load/stack: .env, kod mailleri, ölçümler), LOAD_PROJECT (cg-load), K6_IMAGE
# (grafana/k6), LOAD_NODE_IMAGE (derlemenin Node imajı; vekil sertifikası gereken ortamlarda).

set -euo pipefail

REPO=$(cd "$(dirname "$0")/../.." && pwd)
PROJECT=${LOAD_PROJECT:-cg-load}
PORT=${LOAD_PORT:-3205}
DB_PORT=${LOAD_DB_PORT:-15205}
OUTBOX_PORT=${LOAD_OUTBOX_PORT:-13205}
STATE=${LOAD_STATE_DIR:-/tmp/cg-load/stack}
K6_IMAGE=${K6_IMAGE:-grafana/k6}
NODE=(node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON)

# "cyberguard" canlı yığının (ve yerelde docker-compose.yml'nin) proje adıdır: "down" onun
# veritabanı birimini silerdi. Yük yığını her zaman ayrı bir projedir (güvenlik turu 5).
if [ "$PROJECT" = cyberguard ]; then
  echo "LOAD_PROJECT asıl yığının adı olamaz (cyberguard); yük yığını ayrı bir proje olmalı (ör. cg-load)."
  exit 1
fi

dc() {
  docker compose -p "$PROJECT" --project-directory "$STATE" \
    -f "$REPO/docker-compose.yml" -f "$REPO/docker/server/compose.yml" -f "$REPO/tests/load/compose.yml" "$@"
}

# Yığının .env'i (depoda değil, durum klasöründe). Şifre ve oturum imzası bir kez rastgele üretilir.
ensure_env() {
  mkdir -p "$STATE/outbox"
  # Uygulama konteynerde "node" kullanıcısıdır (uid 1000); kod mailleri bu klasöre yazılır.
  chmod 777 "$STATE/outbox"
  if [ ! -f "$STATE/.env" ]; then
    (
      umask 077
      cat > "$STATE/.env" <<ENV
# Yük testi yığını (tests/load/stack.sh üretti). Yalnızca bu makinede.
POSTGRES_USER=cyberguard
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=cyberguard
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
BETTER_AUTH_URL=http://localhost:$PORT
MAIL_FROM_ADDRESS=no-reply@localhost
DOMAIN=localhost
APP_VERSION=load
APP_PORT=$PORT
LOAD_DB_PORT=$DB_PORT
LOAD_OUTBOX_DIR=$STATE/outbox
COMPOSE_PROFILES=
ENV
    )
  fi
}

# prepare.ts ve cleanup.ts için: yığının veritabanı (127.0.0.1) ve oturum ayarları.
with_stack_env() {
  ensure_env
  set -a
  # shellcheck disable=SC1091
  . "$STATE/.env"
  set +a
  export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:$DB_PORT/$POSTGRES_DB?schema=public"
  "$@"
}

is_healthy() {
  local state=""
  for _ in $(seq 1 90); do
    state=$(dc ps app --format '{{.Health}}' 2> /dev/null || true)
    [ "$state" = "healthy" ] && return 0
    sleep 2
  done
  echo "Uygulama sağlıklı değil (durum: ${state:-yok})."
  dc logs --no-color --tail 60 migrate app || true
  return 1
}

build() {
  local args=(--network host)
  [ -n "${LOAD_NODE_IMAGE:-}" ] && args+=(--build-arg "NODE_IMAGE=$LOAD_NODE_IMAGE")
  # Vekil (proxy) ardındaki ortamlarda npm ci için; bu değişkenler imajın geçmişine yazılmaz.
  [ -n "${HTTPS_PROXY:-}" ] && args+=(--build-arg "HTTPS_PROXY=$HTTPS_PROXY")
  docker build "${args[@]}" -f "$REPO/docker/Dockerfile" --target runner -t cg-load-app:local "$REPO"
  docker build "${args[@]}" -f "$REPO/docker/Dockerfile" --target migrate -t cg-load-migrate:local "$REPO"
}

k6() {
  local script=$1
  shift
  mkdir -p "$REPO/tests/load/.data"
  docker run --rm --name "$PROJECT-k6" --user "$(id -u):$(id -g)" --network host \
    -v "$REPO/tests/load:/load" -e "BASE_URL=http://localhost:$PORT" \
    "${K6_ENV[@]}" "$K6_IMAGE" run --quiet "/load/$script" "$@"
}

# docker stats her örnekte ~2 sn sürer; 5 sn'lik döngüde her satır: zaman, ad, CPU %, bellek.
stats_start() {
  mkdir -p "$STATE"
  : > "$STATE/stats.txt"
  : > "$STATE/host-cpu.txt"
  (
    while true; do
      docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' "$PROJECT-app-1" "$PROJECT-db-1" "$PROJECT-k6" 2> /dev/null \
        | sed "s/^/$(date +%s) /" >> "$STATE/stats.txt" || true
      # Makinenin toplam CPU'su (bütün işler dahil): /proc/stat'ın ilk satırı.
      echo "$(date +%s) $(head -n 1 /proc/stat)" >> "$STATE/host-cpu.txt"
      sleep 3
    done
  ) &
  echo $! > "$STATE/stats.pid"
}

stats_stop() {
  [ -f "$STATE/stats.pid" ] && kill "$(cat "$STATE/stats.pid")" 2> /dev/null || true
  rm -f "$STATE/stats.pid"
  echo "CPU (çekirdek yüzdesi; 100 = bir çekirdek) ve bellek, örnek sayısı:"
  awk '{ gsub("%", "", $3); v = $3 + 0; n[$2]++; s[$2] += v; if (v > m[$2] + 0) m[$2] = v; mem[$2] = $4 }
       END { for (k in n) printf "  %-18s ort %6.1f%%  en çok %6.1f%%  son bellek %s  (%d örnek)\n", k, s[k] / n[k], m[k], mem[k], n[k] }' "$STATE/stats.txt"
  awk 'NR > 1 { busy = ($3 + $4 + $5 + $8 + $9 + $10) - pb; total = ($3 + $4 + $5 + $6 + $7 + $8 + $9 + $10) - pt; if (total > 0) { sum += busy / total; n++; if (busy / total > max) max = busy / total } }
       { pb = $3 + $4 + $5 + $8 + $9 + $10; pt = $3 + $4 + $5 + $6 + $7 + $8 + $9 + $10 }
       END { if (n) printf "  makine (4 çekirdek, bütün işler) ort %%%.0f  en çok %%%.0f\n", 100 * sum / n, 100 * max }' "$STATE/host-cpu.txt"
}

school() {
  local server_pid
  "${NODE[@]}" "$REPO/tests/load/outbox-server.ts" "$STATE/outbox" "$OUTBOX_PORT" &
  server_pid=$!
  trap 'kill $server_pid 2> /dev/null || true' RETURN
  sleep 1
  K6_ENV+=(-e "OUTBOX_URL=http://127.0.0.1:$OUTBOX_PORT")
  k6 school-ip.js "$@"
}

K6_ENV=()
for name in VUS RAMP HOLD RAMP_DOWN THINK HACK_RATE STUDENTS CLASSES WINDOW SCHOOL_IP SUMMARY; do
  [ -n "${!name:-}" ] && K6_ENV+=(-e "$name=${!name}")
done

command=${1:-}
shift || true
case "$command" in
  build) build ;;
  up)
    ensure_env
    dc up -d --no-build --remove-orphans
    is_healthy
    echo "Yığın hazır: http://localhost:$PORT (proje $PROJECT)"
    ;;
  actions) (cd "$REPO" && "${NODE[@]}" tests/load/actions.ts --container "$PROJECT-app-1") ;;
  prepare) (cd "$REPO" && with_stack_env "${NODE[@]}" tests/load/prepare.ts "$@") ;;
  cleanup) (cd "$REPO" && with_stack_env "${NODE[@]}" tests/load/cleanup.ts) ;;
  k6) k6 "$@" ;;
  school) school "$@" ;;
  stats-start) stats_start ;;
  stats-stop) stats_stop ;;
  logs) dc logs --no-color --tail "${1:-100}" app ;;
  down) dc down -v --remove-orphans ;;
  *)
    sed -n '2,20p' "$0"
    exit 1
    ;;
esac
