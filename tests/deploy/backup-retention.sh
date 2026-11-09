#!/usr/bin/env bash
# Yedek saklama kurallarının denemesi (docker/server/backup-lib.sh, prune_backups). Docker ve
# veritabanı gerekmez; geçici bir klasörde sahte yedek dosyalarıyla çalışır. CI'da (ci.yml,
# "Lint, tip ve birim testleri") ve yerelde:
#   bash tests/deploy/backup-retention.sh
# Son satır "SAKLAMA DENEMESİ GEÇTİ"; bir beklenti tutmazsa nedeni yazılır ve çıkış kodu 1 olur.

set -euo pipefail

repo=$(cd "$(dirname "$0")/../.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export BACKUP_DIR=$work/backups
outside=$work/outside
mkdir -p "$BACKUP_DIR/alt" "$outside"

# shellcheck source=docker/server/backup-lib.sh
. "$repo/docker/server/backup-lib.sh"

failures=0
expect_gone() { if [ -e "$BACKUP_DIR/$1" ] || [ -L "$BACKUP_DIR/$1" ]; then echo "silinmeliydi: $1"; failures=$((failures + 1)); fi; }
expect_kept() { if [ ! -e "$BACKUP_DIR/$1" ]; then echo "kalmalıydı: $1"; failures=$((failures + 1)); fi; }
backup() { # $1: uzantısız ad, $2: dosyaların yaşı (touch -d), $3: .counts'un yaşı (verilmezse aynı)
  touch -d "$2" "$BACKUP_DIR/$1.dump"
  touch -d "${3:-$2}" "$BACKUP_DIR/$1.counts"
}

# Yaş sınırı (7 gün): eski yedeğin iki dosyası birlikte gider, yenisi kalır.
backup cyberguard-nightly-20261001T003000Z '9 days ago'
backup cyberguard-nightly-20261008T003000Z '4 days ago'
backup cyberguard-nightly-20261002T003000Z '9 days ago' 'now'

# Adında nokta olan, elle konmuş eski bir dosya başka bir yedeği sildirmez, kendisi gider.
touch -d '9 days ago' "$BACKUP_DIR/cyberguard-elle-kopya.eski.dump"
backup cyberguard-elle-kopya 'now'

# Adında satır sonu olan eski bir dosya, adının ikinci satırındaki yeni yedeği sildirmez.
newline_name=$'cyberguard-nightly-x\ncyberguard-nightly-20261008T003000Z'
touch -d '9 days ago' "$BACKUP_DIR/$newline_name.dump"

# En yeni 3 yayın öncesi yedek kalır.
for day in 01 02 03 04 05; do backup "cyberguard-predeploy-202610${day}T120000Z" 'now'; done

# Az önce alınan yedek (adı en eski görünse de) hiçbir kuralla silinmez.
keep=cyberguard-manual-20260901T000000Z
backup "$keep" 'now'
for day in 01 02 03; do backup "cyberguard-manual-202610${day}T120000Z" 'now'; done

# Sembolik bağlantılar: gösterdikleri dosyaya dokunulmaz.
echo hedef > "$outside/target.txt"
touch -d '9 days ago' "$BACKUP_DIR/cyberguard-nightly-20261003T003000Z.dump"
ln -s "$outside/target.txt" "$BACKUP_DIR/cyberguard-nightly-20261003T003000Z.counts"
echo kurban > "$outside/victim.dump"
touch -d '9 days ago' "$outside/victim.dump"
ln -s "$outside/victim.dump" "$BACKUP_DIR/cyberguard-nightly-20261004T003000Z.dump"
touch -h -d '9 days ago' "$BACKUP_DIR/cyberguard-nightly-20261004T003000Z.dump"

# Bizim olmayan dosyalar ve alt klasör.
touch -d '9 days ago' "$BACKUP_DIR/notlar.txt" "$BACKUP_DIR/.cyberguard-abc.partial" "$BACKUP_DIR/alt/cyberguard-nightly-20261001T003000Z.dump"

prune_backups "$keep" > "$work/output.txt"
cat "$work/output.txt"

expect_gone cyberguard-nightly-20261001T003000Z.dump
expect_gone cyberguard-nightly-20261001T003000Z.counts
expect_kept cyberguard-nightly-20261008T003000Z.dump
expect_kept cyberguard-nightly-20261008T003000Z.counts
expect_gone cyberguard-nightly-20261002T003000Z.dump
expect_gone cyberguard-nightly-20261002T003000Z.counts

expect_gone cyberguard-elle-kopya.eski.dump
expect_kept cyberguard-elle-kopya.dump
expect_kept cyberguard-elle-kopya.counts
expect_gone "$newline_name.dump"

expect_gone cyberguard-predeploy-20261001T120000Z.dump
expect_gone cyberguard-predeploy-20261002T120000Z.counts
for day in 03 04 05; do expect_kept "cyberguard-predeploy-202610${day}T120000Z.dump"; done

expect_kept "$keep.dump"
expect_kept "$keep.counts"
for day in 01 02 03; do expect_kept "cyberguard-manual-202610${day}T120000Z.dump"; done

expect_gone cyberguard-nightly-20261003T003000Z.dump
expect_gone cyberguard-nightly-20261003T003000Z.counts
[ -f "$outside/target.txt" ] || { echo "bağlantının gösterdiği dosya silinmemeliydi"; failures=$((failures + 1)); }
[ -f "$outside/victim.dump" ] || { echo "bağlantının gösterdiği yedek silinmemeliydi"; failures=$((failures + 1)); }

expect_kept notlar.txt
expect_kept .cyberguard-abc.partial
expect_kept alt/cyberguard-nightly-20261001T003000Z.dump

if [ "$failures" -gt 0 ]; then
  echo "SAKLAMA DENEMESİ BAŞARISIZ: $failures beklenti tutmadı"
  exit 1
fi
echo "SAKLAMA DENEMESİ GEÇTİ"
