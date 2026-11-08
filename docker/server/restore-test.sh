#!/usr/bin/env bash
# Geri yükleme denemesi: bir yedeği geçici bir PostgreSQL konteynerine geri yükler, tablo satır
# sayılarını yedekle birlikte yazılanlarla (.counts) birebir karşılaştırır, birkaç anlamlı sorgu
# çalıştırır ve konteyneri siler.
#   bash docker/server/restore-test.sh [yedek.dump]   (verilmezse yedek klasöründeki en yenisi)
# Sunucuda: GitHub → Actions → Yayın → Run workflow → restore-test. CI her PR'da çalıştırır.
#
# Canlı veritabanına ve birimine (cyberguard_db-data) dokunmaz: docker compose çağırmaz, yığının
# hiçbir konteynerine bağlanmaz. Kullandığı tek konteyner kendi açtığı geçici konteynerdir:
#   - ağ yok (--network none), birim yok (veri yalnızca bellekte, tmpfs; silinince iz kalmaz),
#   - kök dosya sistemi salt okunur, ayrıcalıksız kullanıcı (postgres), Linux yetkileri kapalı,
#   - yedek ona bağlanmaz, stdin'den okunur.
# Diğer işlerin konteyner, birim ve dosyalarına da dokunmaz.
#
# Çıktıda kişisel veri yok (Actions kaydında görünür): yalnızca tablo adları, sayılar, migration
# adları ve tarihler.
#
# Son satır sonucu söyler: "GERİ YÜKLEME BAŞARILI: ..." ya da "GERİ YÜKLEME BAŞARISIZ: ...";
# çıkış kodu 0 ya da 1.

set -euo pipefail

# shellcheck source=docker/server/backup-lib.sh
. "$(dirname "$0")/backup-lib.sh"

# docker-compose.yml'deki db imajının aynısı.
RESTORE_IMAGE=postgres:16-alpine
# Geçici veritabanının bellekteki üst sınırı (tmpfs) ve konteynerin bellek sınırı. Geri yüklenen
# veritabanı 1 GB'a yaklaşırsa ikisi de artırılmalı.
DATA_LIMIT=1g
MEMORY_LIMIT=1536m
LABEL=cyberguard.restore-test=1

started=$(date +%s)
FILE=""
CONTAINER=""
REASON="beklenmeyen hata"
SUMMARY=""

fail() {
  REASON=$*
  exit 1
}

# Her çıkışta geçici konteyner silinir; sonuç satırı ancak ondan sonra yazılır. Yalnızca bu
# betiğin etiketini taşıyan konteyner silinir: aynı adda başka bir konteyner olsa da dokunulmaz.
ours() { "${DOCKER[@]}" ps -aq --filter "name=^${CONTAINER}\$" --filter "label=$LABEL" 2> /dev/null; }
finish() {
  local status=$? id
  id=""
  if [ -n "$CONTAINER" ]; then id=$(ours); fi
  if [ -n "$id" ]; then
    "${DOCKER[@]}" rm -f "$id" > /dev/null 2>&1 || true
    if [ -n "$(ours)" ]; then
      status=1
      REASON="geçici konteyner silinemedi: $CONTAINER"
    else
      echo "Geçici konteyner silindi."
    fi
  fi
  if [ "$status" -eq 0 ]; then
    echo "GERİ YÜKLEME BAŞARILI: $SUMMARY"
  else
    echo "GERİ YÜKLEME BAŞARISIZ: $REASON${FILE:+ (${FILE##*/})}"
  fi
  exit "$status"
}
trap finish EXIT

"${DOCKER[@]}" info > /dev/null 2>&1 || fail "Docker'a erişilemiyor (${DOCKER[*]})."

# --- Yedek ----------------------------------------------------------------------------------
if [ $# -gt 0 ]; then
  FILE=$1
else
  FILE=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'cyberguard-*.dump' -printf '%T@ %p\n' 2> /dev/null \
    | sort -rn | sed -n '1s/^[^ ]* //p')
  [ -n "$FILE" ] || fail "$BACKUP_DIR içinde yedek yok."
fi
{ [ -f "$FILE" ] && [ -r "$FILE" ]; } || fail "yedek okunamıyor: $FILE"
[ "${FILE%.dump}" != "$FILE" ] || fail "yedek dosyasının adı .dump ile bitmeli."
COUNTS=${FILE%.dump}.counts
[ -f "$COUNTS" ] || fail "satır sayıları dosyası yok: ${COUNTS##*/}"

echo "Yedek: $FILE ($(human_size "$(stat -c %s "$FILE")"))"
sed -n 's/^# \(alındı\|postgres\): /  \1: /p' "$COUNTS"

# Dosya yedek alındıktan sonra değişmiş mi (disk hatası, yarım kopya, elle düzenleme)?
expected_sha=$(sed -n 's/^# sha256: //p' "$COUNTS")
[ -n "$expected_sha" ] || fail "satır sayıları dosyasında sha256 yok."
[ "$(sha256sum "$FILE" | cut -d' ' -f1)" = "$expected_sha" ] || fail "dosya yedek alındıktan sonra değişmiş (sha256 tutmuyor)."
echo "sha256: tutuyor"
EXPECTED=$(grep -v '^#' "$COUNTS" || true)
[ -n "$EXPECTED" ] || fail "satır sayıları dosyası boş."

# --- Geçici konteyner -------------------------------------------------------------------------
# Aynı anda tek deneme; önceki bir deneme yarıda öldürüldüyse onun konteyneri (yalnızca bu
# etiketi taşıyanlar) silinir.
exec 9> "${TMPDIR:-/tmp}/cyberguard-restore-test-$(id -u).lock"
flock -w 600 9 || fail "başka bir geri yükleme denemesi sürüyor."
"${DOCKER[@]}" ps -aq --filter "label=$LABEL" | xargs -r "${DOCKER[@]}" rm -f > /dev/null

CONTAINER=cyberguard-restore-test-$$
"${DOCKER[@]}" run -d --name "$CONTAINER" --label "$LABEL" \
  --network none --read-only --user postgres --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs "/var/lib/postgresql/data:size=$DATA_LIMIT" --tmpfs /var/run/postgresql --tmpfs /tmp \
  --memory "$MEMORY_LIMIT" --cpus 1 \
  -e PGDATA=/var/lib/postgresql/data/pgdata -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_USER=restore -e POSTGRES_DB=restore \
  "$RESTORE_IMAGE" > /dev/null || fail "geçici konteyner açılamadı."

# Güvence: konteynerde hiçbir birim ya da klasör bağlı değil ve ağı yok.
isolation=$("${DOCKER[@]}" inspect -f '{{len .Mounts}} {{.HostConfig.NetworkMode}}' "$CONTAINER")
[ "$isolation" = "0 none" ] || fail "geçici konteyner birimsiz ve ağsız değil ($isolation)."

c_exec() { "${DOCKER[@]}" exec "$CONTAINER" "$@"; }
c_sql() { c_exec psql -X -q -A -t -v ON_ERROR_STOP=1 -U restore -d restore -c "$1"; }

# İlk açılışta imaj veritabanını geçici bir sunucuyla (yalnızca soketten) kurar, sonra asıl
# sunucuyu başlatır; asıl sunucu 127.0.0.1'den cevap verince hazırdır.
ready=no
for _ in $(seq 1 120); do
  if c_exec pg_isready -q -h 127.0.0.1 -U restore -d restore 2> /dev/null; then
    ready=yes
    break
  fi
  sleep 0.5
done
if [ "$ready" != yes ]; then
  "${DOCKER[@]}" logs --tail 20 "$CONTAINER" 2>&1 || true
  fail "geçici PostgreSQL açılmadı."
fi
echo "Geçici konteyner: $CONTAINER (PostgreSQL $(c_sql 'SHOW server_version'), ağ yok, birim yok)"

# --- Geri yükleme --------------------------------------------------------------------------
# Tek işlem: ilk hatada durur ve hiçbir şey yarım kalmaz. Sahiplik ve izinler geçici
# veritabanının kullanıcısına geçer (asıl kullanıcı adları burada yok).
restore_started=$(date +%s)
if ! errors=$("${DOCKER[@]}" exec -i "$CONTAINER" pg_restore --no-owner --no-privileges \
  --exit-on-error --single-transaction -U restore -d restore < "$FILE" 2>&1); then
  # Hata satırları Actions kaydına da gider: satırın verisini taşıyabilen ayrıntılar (DETAIL,
  # CONTEXT, "Failing row contains", "Key (...)=(...)") yazılmaz; yalnızca hatanın kendisi.
  printf '%s\n' "$errors" | grep -v -i -e 'DETAIL:' -e 'CONTEXT:' -e 'Failing row' -e 'Key (' | cut -c 1-200 | tail -n 5
  fail "pg_restore hata verdi."
fi
echo "Geri yükleme: tamam ($(($(date +%s) - restore_started)) sn)"

# --- Satır sayıları ---------------------------------------------------------------------------
ACTUAL=$(c_sql "$ROW_COUNT_SQL") || fail "geri yüklenen veritabanında satırlar sayılamadı."
TABLES=$(wc -l <<< "$EXPECTED")
ROWS=$(awk '{ s += $2 } END { print s + 0 }' <<< "$EXPECTED")
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "Satır sayıları tutmuyor:"
  LC_ALL=C join -a 1 -a 2 -e yok -o 0,1.2,2.2 <(LC_ALL=C sort <<< "$EXPECTED") <(LC_ALL=C sort <<< "$ACTUAL") \
    | awk '$2 != $3 { printf "  %s: yedekte %s, geri yüklenende %s\n", $1, $2, $3 }'
  fail "satır sayıları yedek alınırken sayılanlarla aynı değil."
fi
echo "Satır sayıları: $TABLES tablonun hepsi birebir aynı (toplam $ROWS satır)"

# --- Anlamlı sorgular ------------------------------------------------------------------------
# Yalnızca sayılar ve tarihler; ad, e-posta gibi kişisel veri yazılmaz.
query() { # $1: başlık, $2: SQL
  local value
  value=$(c_sql "$2") || fail "sorgu çalışmadı: $1"
  printf '  %s %s\n' "$1:" "$value"
}
echo "Sorgular:"

# Migration'ların hepsi bitmiş olmalı (yarım kalan ya da hata veren yok).
out=$(c_sql "SELECT count(*) FILTER (WHERE rolled_back_at IS NULL),
  count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL),
  coalesce(max(migration_name) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL), '-')
  FROM _prisma_migrations") || fail "migration tablosu okunamadı."
IFS='|' read -r migrations unfinished last_migration <<< "$out"
{ [ "$migrations" -gt 0 ] && [ "$unfinished" -eq 0 ]; } \
  || fail "migration'lar eksik ya da yarım ($migrations uygulanmış, $unfinished bitmemiş)."
printf '  %s %s\n' "Migration:" "$migrations uygulanmış, en yenisi $last_migration"

# Yabancı anahtarlar geri yüklemede veriyle birlikte yeniden kurulur ve denetlenir; hepsi
# doğrulanmış olmalı (yetim kayıt yok).
out=$(c_sql "SELECT count(*), count(*) FILTER (WHERE NOT convalidated) FROM pg_constraint WHERE contype = 'f'") \
  || fail "kısıtlar okunamadı."
IFS='|' read -r foreign_keys unvalidated <<< "$out"
{ [ "$foreign_keys" -gt 0 ] && [ "$unvalidated" -eq 0 ]; } \
  || fail "yabancı anahtarlar eksik ya da doğrulanmamış ($foreign_keys anahtar, $unvalidated doğrulanmamış)."
printf '  %s %s\n' "Yabancı anahtar:" "$foreign_keys, hepsi doğrulanmış"

query "Kullanıcılar" "SELECT coalesce(string_agg(role || ' ' || n, ', ' ORDER BY role), 'yok')
  FROM (SELECT role::text AS role, count(*) AS n FROM \"User\" GROUP BY 1) s"
query "Mahalle ve lab" "SELECT (SELECT count(*) FROM \"Neighborhood\") || ' mahalle, '
  || (SELECT count(*) FROM \"Lab\") || ' lab (' || (SELECT count(*) FROM \"Lab\" WHERE status = 'PUBLISHED') || ' yayında)'"
query "Lab denemeleri" "SELECT count(*) || ' deneme, ' || count(DISTINCT \"userId\") || ' öğrenci' FROM \"LabAttempt\""
query "Öğretmen belgeleri" "SELECT count(*) || ' belge, ' || coalesce(sum(octet_length(data)), 0) || ' bayt' FROM \"ApplicationDocument\""
query "En yeni kayıt" "SELECT coalesce(to_char(max(t), 'YYYY-MM-DD HH24:MI') || ' UTC', 'yok') FROM (
  SELECT max(\"createdAt\") AS t FROM \"User\" UNION ALL SELECT max(\"startedAt\") FROM \"LabAttempt\"
  UNION ALL SELECT max(\"createdAt\") FROM \"AuditLog\") s"

SUMMARY="${FILE##*/} ($TABLES tablo, $ROWS satır, $(($(date +%s) - started)) sn)"
