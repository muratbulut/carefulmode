#!/usr/bin/env bash
# Veritabanının yedeğini alır: cyberguard yığınının db servisinden pg_dump (özel biçim, -Fc).
#   bash docker/server/backup.sh <nightly|predeploy|manual>
#     nightly    gece zamanlayıcısı (cyberguard-backup.timer, her gece 03:30 Türkiye saati)
#     predeploy  deploy.sh, migration'dan önce
#     manual     elle: GitHub → Actions → Yayın → Run workflow → backup, ya da sunucuda
#
# Yedekler yalnızca bu sunucuda, /opt/backups/cyberguard içinde durur (klasör 700, dosyalar
# 600). Sunucu dışına kopya yok (Murat'ın kararı, Ekim 2026: gizlilik metni "veriler
# Türkiye'deki sunucuda saklanır" der).
#
# Her yedek iki dosyadır:
#   cyberguard-<tür>-<UTC zaman>.dump    pg_dump -Fc
#   cyberguard-<tür>-<UTC zaman>.counts  dump'la aynı anlık görüntüde (snapshot) sayılan tablo
#                                        satır sayıları ve dump'ın sha256'sı; geri yükleme
#                                        denemesi (restore-test.sh) bunlarla karşılaştırır
# Dosyalar önce geçici adla yazılır, doğrulanınca asıl adına taşınır: yarım ya da bozuk yedek
# asıl adla hiç görünmez.
#
# Saklama (eskiler ancak yeni yedek doğrulandıktan sonra silinir, yani en az bir sağlam yedek
# her zaman kalır):
#   - hiçbir yedek 7 günden eski kalmaz: hesabını silen kullanıcının verisi en geç 7 gün sonra
#     yedeklerden de çıkar;
#   - gece yedeklerinden bu geceki dahil son 7 gece kalır;
#   - yayın öncesi ve elle alınan yedeklerden en yeni 3'er tane kalır.
#
# Şifre gerekmez ve hiçbir komut satırına girmez: pg_dump ve psql db konteynerinin içinde,
# yerel soketle (Postgres imajı konteyner içi bağlantılara güvenir) çalışır; kullanıcı ve
# veritabanı adını konteynerin kendi ortamından okur.
#
# Ayrılık: yalnızca cyberguard yığınının db konteynerini okur, yalnızca yedek klasörüne yazar,
# yalnızca kendi adlandırdığı (cyberguard-*) dosyaları siler. Dosyayı doğrulamak için açtığı
# geçici konteyner ağsız ve birimsizdir. Diğer işlerin konteyner, birim
# ve dosyalarına dokunmaz.

set -euo pipefail
# Veritabanı oturumu (aşağıda psql) beklenmedik kapanırsa ona yazmak betiği sessizce
# öldürmesin, hata olarak yakalansın. Oturum bitince eski haline döner.
trap '' PIPE

KIND=${1:-}
case "$KIND" in
  nightly | predeploy | manual) ;;
  *)
    echo "Kullanım: backup.sh <nightly|predeploy|manual>" >&2
    exit 2
    ;;
esac

# shellcheck source=docker/server/backup-lib.sh
. "$(dirname "$0")/backup-lib.sh"

# Saklama süreleri (KEEP_DAYS, KEEP_LATEST) backup-lib.sh'te.
# Yedekten sonra diskte en az bu kadar boş yer kalmalı (sunucu paylaşılıyor; diğer işler sıkışmasın).
RESERVE_MB=1024

fail() {
  echo "YEDEK ALINAMADI: $*" >&2
  exit 1
}

started=$(date +%s)
umask 077
"${DOCKER[@]}" info > /dev/null 2>&1 || fail "Docker'a erişilemiyor (${DOCKER[*]})."

# --- Klasör ve kilit ---------------------------------------------------------------------
if [ ! -d "$BACKUP_DIR" ]; then install -d -m 700 "$BACKUP_DIR" || fail "$BACKUP_DIR oluşturulamadı."; fi
if [ -O "$BACKUP_DIR" ]; then chmod 700 "$BACKUP_DIR"; fi
[ -w "$BACKUP_DIR" ] || fail "$BACKUP_DIR klasörüne yazılamıyor."
# Aynı anda tek yedek: gece yedeği bir yayına denk gelirse biri ötekini bekler. Kilit klasörün
# kendisindedir (ayrı bir kilit dosyası, biri betiği bir kez root olarak çalıştırırsa başkasına
# kapanabilirdi).
exec 9< "$BACKUP_DIR"
flock -w 900 9 || fail "başka bir yedek 15 dakikadır sürüyor."
# Yarıda kesilmiş (elektrik kesintisi gibi) eski denemelerin geçici dosyaları.
find "$BACKUP_DIR" -maxdepth 1 -type f -name '.cyberguard-*.partial' -mmin +1440 -delete

# --- Veritabanı konteyneri ---------------------------------------------------------------
# Compose etiketleriyle bulunur: yalnızca bu yığının (cyberguard) db servisi, başka hiçbir şey.
mapfile -t containers < <("${DOCKER[@]}" ps -q \
  --filter "label=com.docker.compose.project=$PROJECT" \
  --filter "label=com.docker.compose.service=db" \
  --filter "label=com.docker.compose.oneoff=False")
[ "${#containers[@]}" -eq 1 ] || fail "$PROJECT yığınının veritabanı (db) çalışmıyor."
DB=${containers[0]}
# Doğrulama, canlı veritabanıyla aynı imajla (aynı pg_restore sürümü) yapılır; indirme gerekmez.
IMAGE=$("${DOCKER[@]}" inspect -f '{{.Image}}' "$DB")

# db konteynerinde tek bir SQL komutu (yerel soket; şifre yok).
# shellcheck disable=SC2016 # $1 ve POSTGRES_* konteynerin içinde açılır
db_sql() { "${DOCKER[@]}" exec "$DB" sh -c 'exec psql -X -q -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' sh "$1"; }

# --- Disk -------------------------------------------------------------------------------
# Sıkıştırılmış dump veritabanının diskteki boyutundan küçüktür; bu yüzden ölçü güvenli tarafta.
db_bytes=$(db_sql 'SELECT pg_database_size(current_database())') || fail "veritabanına bağlanılamadı."
free_kb=$(df -Pk "$BACKUP_DIR" | awk 'NR == 2 { print $4 }')
if [ $((free_kb / 1024)) -lt $((db_bytes / 1048576 + RESERVE_MB)) ]; then
  fail "diskte yer yok: boş $((free_kb / 1024)) MB, gereken $((db_bytes / 1048576 + RESERVE_MB)) MB (veritabanı + $RESERVE_MB MB pay). Eski yedekler silinmedi."
fi

# --- Dosya adları -----------------------------------------------------------------------
stamp=$(date -u +%Y%m%dT%H%M%SZ)
NAME=cyberguard-$KIND-$stamp
n=1
while [ -e "$BACKUP_DIR/$NAME.dump" ] || [ -e "$BACKUP_DIR/$NAME.counts" ]; do
  NAME=cyberguard-$KIND-$stamp-$n
  n=$((n + 1))
done
TMP_DUMP=$(mktemp "$BACKUP_DIR/.cyberguard-XXXXXX.partial")
TMP_COUNTS=$(mktemp "$BACKUP_DIR/.cyberguard-XXXXXX.partial")
PSQL_PID=""
cleanup() {
  rm -f "$TMP_DUMP" "$TMP_COUNTS"
  if [ -n "$PSQL_PID" ]; then kill "$PSQL_PID" 2> /dev/null || true; fi
}
trap cleanup EXIT

# --- Aynı anlık görüntüde satır sayıları ve dump -------------------------------------------
# Salt okunur bir işlem (REPEATABLE READ) açılır ve anlık görüntüsü dışa verilir. Satırlar bu
# işlemde sayılır, pg_dump --snapshot ile aynı anlık görüntüyü okur. Site o sırada yazsa da
# sayılar dump'ın içeriğiyle birebir aynıdır. İşlem dump bitene kadar açık kalır.
# shellcheck disable=SC2016 # POSTGRES_* konteynerin içinde açılır
coproc SNAP { "${DOCKER[@]}" exec -i "$DB" sh -c 'exec psql -X -q -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' 2>&1; }
PSQL_PID=$SNAP_PID
# Bash süreç bitince SNAP dizisini siler; kendi kopyalarımız kalır.
exec {snap_in}>&"${SNAP[1]}" {snap_out}<&"${SNAP[0]}"
snap_send() { printf '%s\n' "$@" >&"$snap_in" || fail "veritabanı oturumu kapandı."; }
# psql'in "__end__" satırına kadar yazdıklarını REPLY_LINES dizisine okur.
snap_read() {
  local line found=no
  REPLY_LINES=()
  while IFS= read -r -t "$1" -u "$snap_out" line; do
    if [ "$line" = __end__ ]; then
      found=yes
      break
    fi
    REPLY_LINES+=("$line")
  done
  [ "$found" = yes ]
}

snap_send 'BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY;' 'SELECT pg_export_snapshot();' '\echo __end__'
snap_read 60 || fail "anlık görüntü alınamadı: ${REPLY_LINES[*]:-yanıt yok}"
SNAPSHOT=${REPLY_LINES[0]:-}
[[ "$SNAPSHOT" =~ ^[0-9A-F]+-[0-9A-F]+-[0-9]+$ ]] || fail "anlık görüntü alınamadı: ${REPLY_LINES[*]:-yanıt yok}"

snap_send 'SHOW server_version;' "$ROW_COUNT_SQL" '\echo __end__'
snap_read 900 || fail "satırlar sayılamadı: ${REPLY_LINES[*]: -3}"
SERVER_VERSION=${REPLY_LINES[0]}
COUNTS=("${REPLY_LINES[@]:1}")
[ "${#COUNTS[@]}" -gt 0 ] || fail "veritabanında tablo yok."
ROWS=0
for line in "${COUNTS[@]}"; do
  [[ "$line" =~ ^[^[:space:]]+\ ([0-9]+)$ ]] || fail "beklenmeyen satır sayısı çıktısı: $line"
  ROWS=$((ROWS + BASH_REMATCH[1]))
done

# shellcheck disable=SC2016 # $1 ve POSTGRES_* konteynerin içinde açılır
"${DOCKER[@]}" exec "$DB" sh -c 'exec pg_dump -Fc --snapshot="$1" -U "$POSTGRES_USER" -d "$POSTGRES_DB"' sh "$SNAPSHOT" > "$TMP_DUMP" \
  || fail "pg_dump hata verdi."
snap_send 'COMMIT;' '\q'
wait "$PSQL_PID" || fail "veritabanı oturumu düzgün kapanmadı."
PSQL_PID=""
trap - PIPE

# --- Doğrulama -----------------------------------------------------------------------------
# Dosya, geçici bir konteynerde okunur (ağ yok, birim yok, dosya stdin'den): içindekiler listesi
# (pg_restore --list) her tablonun verisini içermeli ve bütün veri baştan sona okunabilmeli.
# Yarım kalmış ya da bozuk dosya burada yakalanır.
[ -s "$TMP_DUMP" ] || fail "dump boş."
read_dump() {
  "${DOCKER[@]}" run --rm -i --network none --read-only --user postgres --cap-drop ALL \
    --security-opt no-new-privileges --label cyberguard.backup-verify=1 \
    "$IMAGE" pg_restore "$@" < "$TMP_DUMP"
}
toc=$(read_dump --list) || fail "pg_restore --list dosyayı okuyamadı."
data_entries=$(grep -c ' TABLE DATA ' <<< "$toc" || true)
[ "$data_entries" -eq "${#COUNTS[@]}" ] \
  || fail "içindekiler listesinde $data_entries tablonun verisi var, veritabanında ${#COUNTS[@]} tablo var."
read_dump --file=/dev/null || fail "dump baştan sona okunamadı."
SHA=$(sha256sum "$TMP_DUMP" | cut -d' ' -f1)
SIZE=$(stat -c %s "$TMP_DUMP")

{
  echo "# CyberGuard veritabanı yedeği: $NAME.dump"
  echo "# alındı: $(date -u '+%Y-%m-%d %H:%M:%S') UTC"
  echo "# postgres: $SERVER_VERSION"
  echo "# sha256: $SHA"
  printf '%s\n' "${COUNTS[@]}"
} > "$TMP_COUNTS"
# Önce sayılar, sonra dump: asıl adlı bir dump görünüyorsa sayıları da vardır.
mv "$TMP_COUNTS" "$BACKUP_DIR/$NAME.counts"
mv "$TMP_DUMP" "$BACKUP_DIR/$NAME.dump"
# Sunucuda biri betiği "sudo" ile çalıştırdıysa dosyalar yine klasörün sahibinin (yayın
# kullanıcısının) olsun; yoksa gece yedeği ve geri yükleme denemesi onları okuyamaz.
if [ "$(id -u)" -eq 0 ] && [ ! -O "$BACKUP_DIR" ]; then
  chown --reference="$BACKUP_DIR" "$BACKUP_DIR/$NAME.counts" "$BACKUP_DIR/$NAME.dump"
fi
echo "Yedek alındı: $BACKUP_DIR/$NAME.dump ($(human_size "$SIZE"), ${#COUNTS[@]} tablo, $ROWS satır, $(($(date +%s) - started)) sn)"

# --- Saklama -------------------------------------------------------------------------------
# Kurallar backup-lib.sh'te (prune_backups); az önce alınan yedek hiçbir kuralla silinmez.
prune_backups "$NAME"

echo "Yedekler ($BACKUP_DIR):"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'cyberguard-*.dump' -printf '%f %s\n' | LC_ALL=C sort \
  | while read -r file bytes; do echo "  $file  $(human_size "$bytes")"; done
