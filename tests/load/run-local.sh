#!/usr/bin/env bash
# Tam yerel yük testi tek komutla (npm run load:local): imajları derler, sunucudaki sınırlarla
# yığını kurar (cg-load, 127.0.0.1:3205), yük hesaplarını açar, k6 senaryosunu koşturur, CPU ve
# belleği örnekler, sonunda yük hesaplarını siler ve yığını kaldırır.
#
# Varsayılan doküman hedefinin ölçümüdür: 100 VU, 1 dk ısınma, 10 dk sabit, 1 dk iniş (~13 dk).
# Kısa deneme: npm run load:smoke (10 VU, 2 dk).
#
# Ortam: VUS, RAMP, HOLD, RAMP_DOWN, THINK (k6), LOAD_STUDENTS (hesap sayısı, en az öğrenci VU'su),
# SKIP_BUILD=1 (imajları yeniden derleme), KEEP_STACK=1 (yığını bırak), KEEP_DATA=1 (hesapları
# bırak), LOAD_NODE_IMAGE (vekil sertifikası gereken ortamda derlemenin Node imajı).
# Canlı siteye hiçbir istek atmaz.

set -uo pipefail

cd "$(dirname "$0")/../.."
stack() { bash tests/load/stack.sh "$@"; }
STATE=${LOAD_STATE_DIR:-/tmp/cg-load/stack}

started=$(date +%s)
if [ "${SKIP_BUILD:-}" != "1" ]; then
  echo "== İmajlar derleniyor"
  stack build > "${TMPDIR:-/tmp}/cg-load-build.log" 2>&1 || {
    tail -40 "${TMPDIR:-/tmp}/cg-load-build.log"
    exit 1
  }
fi

echo "== Yığın"
stack up || exit 1
stack actions || exit 1
echo "== Yük hesapları"
stack prepare --students "${LOAD_STUDENTS:-100}" --teachers "${LOAD_TEACHERS:-4}" || exit 1

echo "== k6: ${VUS:-100} VU, ${RAMP:-1m} ısınma + ${HOLD:-10m} + ${RAMP_DOWN:-1m} iniş"
stack stats-start
stack k6 scenario.js
status=$?
echo "== Kaynak kullanımı"
stack stats-stop
mkdir -p "$STATE"
stamp=$(date +%Y%m%d-%H%M%S)
cp tests/load/.data/summary.json "$STATE/summary-$stamp.json" 2> /dev/null && echo "Özet: $STATE/summary-$stamp.json"
cp "$STATE/stats.txt" "$STATE/stats-$stamp.txt" 2> /dev/null || true

if [ "${KEEP_DATA:-}" != "1" ]; then
  echo "== Temizlik"
  stack cleanup
fi
if [ "${KEEP_STACK:-}" != "1" ]; then stack down > /dev/null 2>&1 && echo "Yığın kaldırıldı."; fi
echo "Toplam süre: $(($(date +%s) - started)) sn · k6 çıkış kodu: $status (99 = eşik aşıldı)"
exit $status
