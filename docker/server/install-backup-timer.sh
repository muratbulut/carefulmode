#!/usr/bin/env bash
# Gece yedeğinin systemd zamanlayıcısını kurar ya da günceller. Tekrar çalıştırılabilir:
# değişiklik yoksa birimlere dokunmaz. Yayın iş akışı (deploy.yml) her yayında çalıştırır.
#   bash docker/server/install-backup-timer.sh
#
# Yalnızca iki birime dokunur: /etc/systemd/system/cyberguard-backup.service ve
# cyberguard-backup.timer (şablonları bu klasörde). Diğer işlerin
# birimlerine, zamanlayıcılarına ve cron işlerine dokunmaz.
#
# Servis, yayın klasörünün sahibi olan kullanıcıyla (yayın kullanıcısı) çalışır; yedekler onun
# klasörüne (/opt/backups/cyberguard) yazılır.
#
# Son satır durumu söyler:
#   BACKUP_TIMER=ready   zamanlayıcı kurulu ve açık
#   BACKUP_TIMER=manual  şifresiz sudo ile systemctl çalışmıyor; README'deki elle kurulum gerekli
#   BACKUP_TIMER=failed  kurulum başarısız (ayrıntı yukarıda)
# Son gece yedeği başarısızsa ayrıca BACKUP_LAST=failed yazılır. Betik her durumda 0 ile çıkar:
# zamanlayıcı yayını düşürmez, iş akışı uyarı verir.

set -uo pipefail

cd "$(dirname "$0")" || exit 0
SERVER_DIR=$(pwd -P)
DEPLOY_DIR=$(cd ../.. && pwd -P)
UNIT_DIR=/etc/systemd/system
SERVICE=cyberguard-backup.service
TIMER=cyberguard-backup.timer

result() {
  echo "BACKUP_TIMER=$1"
  exit 0
}
failed() {
  echo "Zamanlayıcı kurulamadı: $*"
  result failed
}
manual() {
  echo "$*"
  echo "Zamanlayıcı kurulmadı. Sunucuda bir kez elle: sudo bash $SERVER_DIR/install-backup-timer.sh"
  result manual
}

if [ "$(id -u)" -eq 0 ]; then S=(); else S=(sudo -n); fi
[ -d /run/systemd/system ] || manual "Bu makinede systemd çalışmıyor."
"${S[@]}" systemctl --version > /dev/null 2>&1 || manual "Şifresiz sudo ile systemctl çalıştırılamıyor."

# --- Birimler ----------------------------------------------------------------------------
RUN_USER=$(stat -c %U "$DEPLOY_DIR")
RUN_GROUP=$(stat -c %G "$DEPLOY_DIR")
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
for unit in "$SERVICE" "$TIMER"; do
  sed -e "s|__USER__|$RUN_USER|g" -e "s|__GROUP__|$RUN_GROUP|g" -e "s|__DEPLOY_DIR__|$DEPLOY_DIR|g" \
    "$unit" > "$work/$unit" || failed "$unit şablonu okunamadı."
done

changed=no
for unit in "$SERVICE" "$TIMER"; do
  cmp -s "$work/$unit" "$UNIT_DIR/$unit" || changed=yes
done
if [ "$changed" = yes ]; then
  for unit in "$SERVICE" "$TIMER"; do
    "${S[@]}" install -m 644 "$work/$unit" "$UNIT_DIR/$unit" || failed "$UNIT_DIR/$unit yazılamadı."
  done
  "${S[@]}" systemctl daemon-reload || failed "systemctl daemon-reload başarısız."
  echo "Birimler kuruldu: $UNIT_DIR/$SERVICE, $UNIT_DIR/$TIMER (kullanıcı $RUN_USER)"
else
  echo "Birimler değişmedi."
fi

if [ "$changed" = yes ] || ! systemctl is-enabled --quiet "$TIMER" || ! systemctl is-active --quiet "$TIMER"; then
  "${S[@]}" systemctl enable --quiet "$TIMER" || failed "zamanlayıcı açılamadı (enable)."
  "${S[@]}" systemctl restart "$TIMER" || failed "zamanlayıcı başlatılamadı."
fi
systemctl is-active --quiet "$TIMER" || failed "zamanlayıcı çalışmıyor."
echo "Sonraki gece yedeği: $(systemctl show "$TIMER" -p NextElapseUSecRealtime --value)"

# --- Son gece yedeği ----------------------------------------------------------------------
# Sunucu açıldığından beri çalıştıysa sonucu; yedek klasöründeki en yeni gece yedeği.
last_run=$(systemctl show "$SERVICE" -p ExecMainExitTimestamp --value)
last_result=$(systemctl show "$SERVICE" -p Result --value)
if [ -n "$last_run" ]; then
  echo "Son gece yedeği çalışması: $last_run (sonuç: $last_result)"
  [ "$last_result" = success ] || echo "BACKUP_LAST=failed"
fi
newest=$(find /opt/backups/cyberguard -maxdepth 1 -type f -name 'cyberguard-nightly-*.dump' -printf '%f\n' 2> /dev/null \
  | LC_ALL=C sort -r | sed -n 1p)
echo "En yeni gece yedeği: ${newest:-henüz yok}"

result ready
