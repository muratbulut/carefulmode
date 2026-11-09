#!/usr/bin/env bash
# Sunucuya sadece bakar, hiçbir şeyi değiştirmez. Yayın iş akışı (.github/workflows/deploy.yml)
# "inspect" işleminde bunu SSH ile çalıştırır; çıktı GitHub Actions kaydında görünür.
# Amaç: aynı sunucudaki diğer sitelerle (80/443, Docker ağları) çakışmadan yerleşmek.
# Gizli bilgi yazdırmaz: ayar dosyalarından yalnızca alan adı, port ve yol satırları alınır.

set -u

section() { printf '\n== %s\n' "$1"; }
# Kök değilsek şifresiz sudo varsa onu kullan; yoksa yetkisiz dene.
privileged() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; elif sudo -n true 2>/dev/null; then sudo -n "$@"; else "$@"; fi
}

section "Sistem"
# shellcheck disable=SC1091
. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME"
uname -mr
echo "CPU: $(nproc)"
free -h | sed -n '1,2p'
df -h / | tail -1

section "Kullanıcı"
id
if [ "$(id -u)" -ne 0 ]; then sudo -n true 2>/dev/null && echo "şifresiz sudo: var" || echo "şifresiz sudo: yok"; fi

section "Docker"
docker --version 2>&1
docker compose version 2>&1
privileged docker compose ls 2>&1
privileged docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' 2>&1
privileged docker network ls --format '{{.Name}}\t{{.Driver}}' 2>&1
echo "-- Konteyner bağlamaları (kaynak -> hedef)"
for k in $(privileged docker ps -q 2>/dev/null); do
  privileged docker inspect --format '{{.Name}}: {{range .Mounts}}{{.Source}} -> {{.Destination}}  {{end}}' "$k" 2>/dev/null
done

section "Dinlenen portlar"
privileged ss -ltnp 2>&1

section "Web sunucuları"
for s in nginx apache2 httpd caddy traefik haproxy cloudflared; do
  state=$(systemctl is-active "$s" 2>/dev/null)
  path=$(command -v "$s" 2>/dev/null)
  if [ -n "$path" ] || [ "$state" = "active" ]; then echo "$s: ${state:-?} ${path}"; fi
done

section "nginx site ayarları"
nginx -v 2>&1
# Site dosyaları sertifika yolu, alan adı ve port içerir; anahtar ya da şifre içermez.
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
  [ -e "$f" ] || continue
  echo "-- $f -> $(readlink -f "$f")"
  privileged grep -vE '^\s*(#|$)' "$f" 2>&1
done
echo "-- Sertifikalar (konu, alan adları, bitiş)"
for c in $(privileged grep -RhoE 'ssl_certificate\s+[^;]+' /etc/nginx/sites-enabled/ 2>/dev/null | awk '{print $2}' | sort -u); do
  echo "$c"
  privileged openssl x509 -in "$c" -noout -subject -issuer -enddate -ext subjectAltName 2>&1 | sed 's/^/   /'
done
echo "-- Gerçek IP (Cloudflare), yalnızca Cloudflare girişi ve HSTS: hangi dosyada hangi ayar (yalnızca bu yönergeler)"
privileged nginx -T 2>/dev/null | awk '/^# configuration file /{f=$4; sub(/:$/, "", f)}
  /set_real_ip_from/{n[f]++} /real_ip_header|real_ip_recursive|cyberguard_from_cloudflare|Strict-Transport-Security/{print "   " f ": " $0}
  END{for (k in n) print "   " k ": set_real_ip_from x" n[k]}'
echo "-- Let's Encrypt"
privileged ls /etc/letsencrypt/live 2>&1

section "Güvenlik duvarı"
privileged ufw status 2>&1 | head -30

section "/opt"
ls -la /opt /opt/apps /opt/backups 2>&1
echo "-- /opt/apps/DEPLOYMENT-POLICY.md"
cat /opt/apps/DEPLOYMENT-POLICY.md 2>&1
privileged ls -la /opt/apps/chess-panel 2>&1
privileged crontab -l 2>&1 | grep -vE '^\s*(#|$)'
systemctl list-timers --all --no-pager 2>/dev/null | grep -viE 'apt|motd|fstrim|logrotate|man-db|e2scrub|update-notifier|systemd-tmpfiles|dpkg|sysstat|fwupd|snapd' | head -20

section "Yedekler (cyberguard)"
# Yalnızca dosya adları, boyutları ve zamanlayıcının durumu; yedeklerin içi okunmaz.
ls -la /opt/backups/cyberguard 2>&1
systemctl list-timers cyberguard-backup.timer --all --no-pager 2>&1
systemctl show cyberguard-backup.service -p Result -p ExecMainExitTimestamp --no-pager 2>&1

section "Veritabanı (cyberguard, salt okunur)"
# Yalnızca migration durumu ve mahalle başına eğitim odası sayısı (birden çok olabilir; ilki temel).
# Oturum salt okunur açılır; kişisel veri yazdırılmaz, yalnızca adlar ve sayılar.
# Betik SSH'ın standart girdisinden okunur (bash -s); exec girdiyi /dev/null'dan alır, yoksa
# betiğin geri kalanını yutar.
if cd /opt/apps/cyberguard 2>/dev/null; then
  # shellcheck disable=SC2016 # değişkenler konteynerin içinde açılır
  privileged docker compose -f docker-compose.yml -f docker/server/compose.yml exec -T db sh -c \
    'PGOPTIONS="-c default_transaction_read_only=on" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -v ON_ERROR_STOP=1 \
      -c "SELECT migration_name, finished_at IS NOT NULL AS bitti, rolled_back_at IS NOT NULL AS geri_alindi FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5" \
      -c "SELECT \"neighborhoodId\", count(*) AS egitim_odasi FROM \"Lab\" WHERE type = '\''TRAINING'\'' GROUP BY 1"' < /dev/null 2>&1
else
  echo "/opt/apps/cyberguard yok"
fi

section "Kesinti izleri (Cloudflare 522)"
# 522: Cloudflare sunucuyla TCP bağlantısını kuramadı. Aynı anda diğer siteler de düşüyorsa
# sebep makinenin kendisidir (yeniden başlama, bellek, ağ, güvenlik duvarı, Cloudflare IP'sini
# yasaklayan bir araç). Burası yalnızca okur; IP adresi yazdırmaz, yalnızca sayılar.
# Zaman aralığı: KESINTI_BASLA / KESINTI_BITIR (UTC) verilirse o aralığa da ayrıca bakılır.
echo "Şimdi (UTC): $(date -u '+%F %T')  saat dilimi: $(cat /etc/timezone 2>/dev/null || date +%Z)"
uptime
echo "-- Açılışlar ve kapanışlar"
last -x reboot shutdown 2>/dev/null | head -8
privileged journalctl --list-boots --no-pager 2>/dev/null | tail -5
echo "-- Bellek, takas, işlemci çalınması (st)"
free -h
vmstat 1 3 2>/dev/null
cat /proc/pressure/memory /proc/pressure/cpu /proc/pressure/io 2>/dev/null
echo "-- Konteyner kaynakları (anlık)"
privileged docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' 2>&1
echo "-- Konteyner yeniden başlama sayıları ve başlama zamanları"
for k in $(privileged docker ps -aq 2>/dev/null); do
  privileged docker inspect --format '{{.Name}} restarts={{.RestartCount}} started={{.State.StartedAt}} oom={{.State.OOMKilled}}' "$k" 2>/dev/null
done
echo "-- Son 3 günde çekirdek uyarıları (bellek, ağ, SYN, conntrack, donma)"
privileged journalctl -k --since "3 days ago" --no-pager -o short-iso 2>/dev/null \
  | grep -v 'UFW BLOCK' \
  | grep -iE 'out of memory|oom|killed process|syn flooding|conntrack|table full|link is down|link down|hung task|soft lockup|watchdog|clocksource|nic|eth0|ens[0-9]' \
  | tail -40
echo "-- Son 3 günde OOM sayısı: $(privileged journalctl -k --since '3 days ago' --no-pager 2>/dev/null | grep -ciE 'out of memory|oom-kill')"
echo "-- TCP kuyruk taşmaları ve SYN çerezleri (açılıştan beri)"
nstat -az 2>/dev/null | grep -E 'ListenOverflows|ListenDrops|SyncookiesSent|SyncookiesFailed|TCPReqQFullDrop|TCPBacklogDrop' \
  || netstat -s 2>/dev/null | grep -iE 'overflow|SYNs to LISTEN|cookies'
ss -s
echo "conntrack: $(cat /proc/sys/net/netfilter/nf_conntrack_count 2>/dev/null)/$(cat /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null)"
echo "-- 443 ve 80 dinleme kuyruğu (Recv-Q bekleyen / Send-Q sınır)"
privileged ss -ltn '( sport = :443 or sport = :80 )' 2>&1
echo "-- Güvenlik duvarı (ufw ayrıntı, INPUT zinciri sayaçları)"
privileged ufw status verbose 2>&1 | head -40
privileged iptables -L INPUT -n -v --line-numbers 2>&1 | head -40
privileged nft list ruleset 2>/dev/null | grep -cE 'drop|reject' | sed 's/^/nft drop|reject kuralı: /'
# UFW'nin engellediği paketleri özetler: dakika ya da gün başına toplam, 80/443'e gelen ve
# bunların Cloudflare aralığından olanı. Cloudflare'den gelip engellenen paket varsa 522'nin
# sebebi bizim güvenlik duvarımızdır. IP yazdırmaz.
ufw_summary() { # $1: anahtar uzunluğu (10 gün, 16 dakika)
  python3 -I -c '
import ipaddress, re, sys
nets = [ipaddress.ip_network(r) for r in sys.argv[1].split()]
width = int(sys.argv[2])
rows = {}
for line in sys.stdin:
    if "UFW BLOCK" not in line: continue
    src = re.search(r"SRC=(\S+)", line); dpt = re.search(r"DPT=(\d+)", line)
    r = rows.setdefault(line[:width], [0, 0, 0])
    r[0] += 1
    if dpt and dpt.group(1) in ("80", "443"):
        r[1] += 1
        try:
            if src and any(ipaddress.ip_address(src.group(1)) in n for n in nets): r[2] += 1
        except ValueError: pass
print("zaman  engellenen  80/443e  80/443e-Cloudflareden")
for k in sorted(rows): print(k, *rows[k])' "$ranges" "$1"
}
ranges=$(grep -vE '^\s*(#|$)' /opt/apps/cyberguard/docker/server/cloudflare-ips.txt 2>/dev/null)
echo "-- Güvenlik duvarının engelledikleri, son 3 gün (UTC gün başına)"
privileged journalctl -k --since "3 days ago" --no-pager -o short-iso --utc 2>/dev/null | ufw_summary 10
echo "-- Yasaklama araçları (fail2ban, CrowdSec): Cloudflare IP'si yasaklı mı"
for s in fail2ban crowdsec crowdsec-firewall-bouncer; do
  state=$(systemctl is-active "$s" 2>/dev/null); [ "$state" = active ] && echo "$s: aktif"
done
banned=""
if command -v fail2ban-client >/dev/null 2>&1; then
  jails=$(privileged fail2ban-client status 2>/dev/null | sed -n 's/.*Jail list:\s*//p' | tr ',' ' ')
  for j in $jails; do
    ips=$(privileged fail2ban-client status "$j" 2>/dev/null | sed -n 's/.*Banned IP list:\s*//p')
    echo "fail2ban $j: yasaklı $(echo "$ips" | wc -w)"
    banned="$banned $ips"
  done
fi
if command -v cscli >/dev/null 2>&1; then
  ips=$(privileged cscli decisions list -o raw 2>/dev/null | awk -F, 'NR>1{print $3}' | sed 's/^Ip://')
  echo "crowdsec: karar $(echo "$ips" | wc -w)"
  banned="$banned $ips"
fi
if [ -n "$banned" ] && [ -n "$ranges" ] && command -v python3 >/dev/null 2>&1; then
  python3 -I -c '
import ipaddress, sys
nets = [ipaddress.ip_network(r) for r in sys.argv[1].split()]
hits = 0
for ip in sys.argv[2].split():
    try: a = ipaddress.ip_address(ip.split("/")[0])
    except ValueError: continue
    if any(a in n for n in nets): hits += 1
print(f"Yasaklı listede Cloudflare adresi: {hits}")' "$ranges" "$banned"
fi
echo "-- nginx hata kaydı: son 3 günde bağlantı ve işçi uyarıları (sayılar)"
for f in /var/log/nginx/error.log /var/log/nginx/error.log.1; do
  [ -e "$f" ] || continue
  echo "$f:"
  privileged grep -oE 'worker_connections are not enough|too many open files|upstream timed out|no live upstreams|connect\(\) failed|limiting (connections|requests)' "$f" 2>/dev/null | sort | uniq -c
done
privileged nginx -T 2>/dev/null | grep -E '^\s*(worker_processes|worker_connections|worker_rlimit_nofile|limit_conn|limit_req)\b' | sort | uniq -c
if [ -n "${KESINTI_BASLA:-}" ] && [ -n "${KESINTI_BITIR:-}" ]; then
  echo "-- Kesinti aralığı: $KESINTI_BASLA .. $KESINTI_BITIR UTC"
  # Günlükte boşluk (dakikada 0 satır) makinenin donduğunu ya da ağdan koptuğunu gösterir.
  echo "Dakika başına günlük satırı:"
  privileged journalctl --since "$KESINTI_BASLA UTC" --until "$KESINTI_BITIR UTC" --no-pager -o short-iso --utc 2>/dev/null \
    | awk '{print substr($1,1,16)}' | sort | uniq -c
  echo "Güvenlik duvarının engelledikleri (dakika başına):"
  privileged journalctl -k --since "$KESINTI_BASLA UTC" --until "$KESINTI_BITIR UTC" --no-pager -o short-iso --utc 2>/dev/null \
    | ufw_summary 16
  echo "Aralıktaki uyarı ve hatalar (kimlik bilgisi içeren birimler hariç):"
  privileged journalctl --since "$KESINTI_BASLA UTC" --until "$KESINTI_BITIR UTC" --no-pager -o short-iso --utc -p warning 2>/dev/null \
    | grep -viE 'sshd|sudo|pam_|password|UFW BLOCK' | tail -60
  # Erişim kaydı sunucunun yerel saatindedir; aralık yerel saate çevrilir.
  local_start=$(date -d "$KESINTI_BASLA UTC" '+%F %H:%M')
  local_end=$(date -d "$KESINTI_BITIR UTC" '+%F %H:%M')
  echo "nginx erişim kaydı, dakika başına istek (tüm siteler, yerel saat $local_start .. $local_end):"
  for f in /var/log/nginx/access.log /var/log/nginx/access.log.1; do
    # shellcheck disable=SC2016 # awk değişkenleri, kabuk değil
    [ -e "$f" ] && privileged awk -v s="$local_start" -v e="$local_end" '
      BEGIN{split("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec",m," "); for(i=1;i<=12;i++) mon[m[i]]=sprintf("%02d",i)}
      match($0,/\[[0-9]+\/[A-Za-z]+\/[0-9]+:[0-9]+:[0-9]+/){t=substr($0,RSTART+1,RLENGTH-1); split(t,p,/[\/:]/)
        k=p[3]"-"mon[p[2]]"-"p[1]" "p[4]":"p[5]; if(k>=substr(s,1,16) && k<=substr(e,1,16)) c[k]++}
      END{for(k in c) print c[k], k}' "$f" | sort -k2
  done
fi
