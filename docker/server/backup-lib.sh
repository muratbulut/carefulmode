# shellcheck shell=bash disable=SC2034 # değişkenleri içeri alan betikler kullanır
# backup.sh ve restore-test.sh'in ortak parçası; kendi başına çalıştırılmaz, onlar içeri alır.
#
# Ayrılık: bu betikler yalnızca "cyberguard" Docker yığınının db konteynerini (Compose
# etiketleriyle bulunur), yedek klasörünü (/opt/backups/cyberguard) ve kendi açtıkları geçici
# konteynerleri kullanır. Sunucudaki diğer işlerin konteynerlerine,
# birimlerine ve dosyalarına dokunmaz.

# Yedeklerin tek yeri. Sunucu dışına kopya yok (Murat'ın kararı, Ekim 2026). Yerelde ve CI'da
# başka bir klasör verilebilir.
BACKUP_DIR=${BACKUP_DIR:-/opt/backups/cyberguard}

# Yığının adı docker-compose.yml'deki "name: cyberguard". Yerel ve CI denemelerinde aynı
# makinedeki başka bir yığınla çakışmasın diye COMPOSE_PROJECT_NAME ile "cg-..." verilebilir.
# Başka hiçbir ad kabul edilmez: betik başka bir yığının veritabanına bağlanamaz.
PROJECT=${COMPOSE_PROJECT_NAME:-cyberguard}
if [[ ! "$PROJECT" =~ ^(cyberguard|cg-[a-z0-9-]+)$ ]]; then
  echo "Yalnızca cyberguard yığınıyla çalışılır (verilen yığın: $PROJECT)." >&2
  exit 1
fi

# Kullanıcı docker grubunda değilse (sunucudaki gibi) docker şifresiz sudo ile çalışır.
if docker info > /dev/null 2>&1; then DOCKER=(docker); else DOCKER=(sudo -n docker); fi

# Tabloların satır sayıları, "şema.tablo sayı" satırları olarak ve ada göre sıralı. backup.sh
# bunu pg_dump'la aynı anlık görüntüde (snapshot) çalıştırıp .counts dosyasına yazar;
# restore-test.sh geri yüklenen veritabanında aynı sorguyu çalıştırıp birebir karşılaştırır.
# Yalnızca sıradan tablolar (relkind 'r'): pg_dump her birinin verisini ayrı bir
# "TABLE DATA" kaydı olarak yazar, sayıları tutmalıdır.
ROW_COUNT_SQL="SELECT format('%I.%I', n.nspname, c.relname) || ' ' ||
  (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\_toast%'
ORDER BY 1;"

# Bayt sayısını okunur yazar (1.2M gibi).
human_size() { numfmt --to=iec --suffix=B "$1" 2> /dev/null || echo "$1 B"; }

# --- Saklama (backup.sh, yeni yedek doğrulandıktan sonra) ----------------------------------
#   - hiçbir yedek KEEP_DAYS günden eski kalmaz (bütün türler);
#   - yayın öncesi ve elle alınan yedeklerden en yeni KEEP_LATEST'er tane kalır.
# Yalnızca yedek klasörünün kendisindeki (alt klasörler değil) cyberguard-*.dump ve .counts
# dosyalarına bakar; bir yedeğin iki dosyası birlikte silinir. Sembolik bağlantı yedek sayılmaz;
# silinen bir bağlantının gösterdiği dosyaya dokunulmaz. Adı yalnızca uzantısından ayırır
# (".dump", ".counts"): adında nokta olan elle konmuş bir dosya başka bir yedeği sildirmez
# (güvenlik turu 5). Dosya adları NUL ile ayrılır: adında satır sonu olan dosya da tek dosyadır.
KEEP_DAYS=7
KEEP_LATEST=3

# $1: az önce alınan yedeğin adı (uzantısız); hiçbir kuralla silinmez.
prune_backups() {
  local keep=$1 base kind cutoff
  # Bir saatlik pay, gece yedeğinin birkaç dakika kaymasıyla 8. gecenin bazen kalıp bazen
  # silinmesini önler: her gece tam 7 gece kalır.
  cutoff=$((KEEP_DAYS * 24 * 60 - 60))
  while IFS= read -r -d '' base; do
    remove_backup "$base" "$keep" "$KEEP_DAYS günden eski"
  done < <(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'cyberguard-*.dump' -o -name 'cyberguard-*.counts' \) \
    -mmin "+$cutoff" -printf '%f\0' | sed -zE 's/\.(dump|counts)$//' | LC_ALL=C sort -zu)
  for kind in predeploy manual; do
    while IFS= read -r -d '' base; do
      remove_backup "${base%.dump}" "$keep" "en yeni $KEEP_LATEST $kind yedeği kalır"
    done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "cyberguard-$kind-*.dump" -printf '%f\0' \
      | LC_ALL=C sort -zr | tail -zn "+$((KEEP_LATEST + 1))")
  done
}

# $1: yedeğin uzantısız adı, $2: korunan ad, $3: neden. .dump ve .counts birlikte silinir.
remove_backup() {
  if [ "$1" = "$2" ]; then return 0; fi
  rm -f -- "$BACKUP_DIR/$1.dump" "$BACKUP_DIR/$1.counts"
  echo "Silindi ($3): $1"
}
