#!/usr/bin/env bash
# Sunucunun nginx'ine bu sitenin girişini ve HTTPS sertifikasını kurar.
#   bash docker/server/install-nginx.sh <alan-adı> <uygulama-portu>
#
# Yalnızca bu siteye ait dosyalara dokunur; aynı sunucudaki diğer sitelerinkine dokunmaz:
#   /etc/nginx/sites-available/<alan>, /etc/nginx/sites-enabled/<alan>, /etc/nginx/ssl/<alan>/
# Yeni ayar `nginx -t` ile sınanmadan nginx yeniden yüklenmez; sınama geçmezse eski hal
# geri konur ve nginx'e hiç dokunulmamış olur.
#
# Sertifika: Cloudflare Origin sertifikası. Özel anahtar sunucuda üretilir ve sunucudan
# çıkmaz. Sertifikanın kendisi açık bilgidir ve depoda durur: docker/server/<alan>.pem.
# O dosya yoksa betik imza isteğini (CSR) yazdırır ve nginx'e dokunmadan durur.
#
# Son satır durumu söyler: NGINX=ready ya da NGINX=cert-pending

set -euo pipefail

DOMAIN=${1:?alan adı gerekli}
PORT=${2:?uygulama portu gerekli}
cd "$(dirname "$0")"

S=(sudo -n)
SSL=/etc/nginx/ssl/$DOMAIN
SITE=/etc/nginx/sites-available/$DOMAIN
ENABLED=/etc/nginx/sites-enabled/$DOMAIN
CERT=$DOMAIN.pem

# --- 1. Özel anahtar (yalnızca ilk kurulumda üretilir) ---------------------------------
"${S[@]}" install -d -m 700 "$SSL"
if ! "${S[@]}" test -f "$SSL/origin-key.pem"; then
  echo "Özel anahtar üretiliyor: $SSL/origin-key.pem"
  "${S[@]}" sh -c "umask 077 && openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out '$SSL/origin-key.pem' 2> /dev/null"
fi

# --- 2. Sertifika ---------------------------------------------------------------------
if [ ! -s "$CERT" ]; then
  echo "Sertifika henüz yok (docker/server/$CERT)."
  echo "Cloudflare > SSL/TLS > Origin Server > Create Certificate > 'Use my private key and CSR'"
  echo "seçeneğine aşağıdaki imza isteği yapıştırılır, alan adı olarak yalnızca $DOMAIN kalır."
  "${S[@]}" openssl req -new -key "$SSL/origin-key.pem" -subj "/CN=$DOMAIN" -addext "subjectAltName=DNS:$DOMAIN"
  echo "NGINX=cert-pending"
  exit 0
fi
if [ "$(openssl x509 -in "$CERT" -noout -pubkey)" != "$("${S[@]}" openssl pkey -in "$SSL/origin-key.pem" -pubout)" ]; then
  echo "Hata: docker/server/$CERT sunucudaki özel anahtarla eşleşmiyor."
  exit 1
fi
openssl x509 -in "$CERT" -noout -checkhost "$DOMAIN" | grep -q "does match" \
  || { echo "Hata: sertifika $DOMAIN için değil."; exit 1; }
openssl x509 -in "$CERT" -noout -checkend 2592000 > /dev/null \
  || echo "Uyarı: sertifikanın süresi 30 gün içinde doluyor."

# --- 3. Site dosyası ----------------------------------------------------------------
# Cloudflare aralıkları (gerçek ziyaretçi IP'si ve yalnızca Cloudflare'den gelen bağlantı)
# depodaki cloudflare-ips.txt'den site dosyasının kendisine yazılır; sunucudaki başka bir
# sitenin ayar parçasına bağlı değildir. Liste bozuk ya da eksikse nginx'e dokunulmaz.
new_site=$(mktemp)
trap 'rm -f "$new_site"' EXIT
# shellcheck source=docker/server/nginx-render.sh
source ./nginx-render.sh
render_site "$DOMAIN" "$PORT" nginx-site.conf cloudflare-ips.txt > "$new_site"

if "${S[@]}" cmp -s "$new_site" "$SITE" && "${S[@]}" cmp -s "$CERT" "$SSL/origin-cert.pem" \
  && [ "$(readlink "$ENABLED" 2> /dev/null)" = "$SITE" ]; then
  echo "nginx ayarı değişmedi."
  echo "NGINX=ready"
  exit 0
fi

# --- 4. Kur, sına, yükle; sınama geçmezse geri al --------------------------------------
backup=$("${S[@]}" mktemp -d)
"${S[@]}" cp -a "$SITE" "$backup/site" 2> /dev/null || true
"${S[@]}" cp -a "$SSL/origin-cert.pem" "$backup/cert" 2> /dev/null || true
was_enabled=no
[ -L "$ENABLED" ] && was_enabled=yes

"${S[@]}" install -m 644 "$CERT" "$SSL/origin-cert.pem"
"${S[@]}" install -m 644 "$new_site" "$SITE"
"${S[@]}" ln -sfn "$SITE" "$ENABLED"

if "${S[@]}" nginx -t 2>&1; then
  "${S[@]}" systemctl reload nginx
  "${S[@]}" rm -rf "$backup"
  echo "nginx yeniden yüklendi."
  echo "NGINX=ready"
else
  echo "nginx ayarı sınamadan geçmedi; eski hale dönülüyor, nginx yeniden yüklenmedi."
  if "${S[@]}" test -f "$backup/site"; then "${S[@]}" cp -a "$backup/site" "$SITE"; else "${S[@]}" rm -f "$SITE"; fi
  if "${S[@]}" test -f "$backup/cert"; then "${S[@]}" cp -a "$backup/cert" "$SSL/origin-cert.pem"; else "${S[@]}" rm -f "$SSL/origin-cert.pem"; fi
  [ "$was_enabled" = yes ] || "${S[@]}" rm -f "$ENABLED"
  "${S[@]}" rm -rf "$backup"
  "${S[@]}" nginx -t > /dev/null 2>&1 && echo "Eski ayar sağlam." || echo "Uyarı: geri dönüşten sonra da nginx -t geçmiyor."
  exit 1
fi
