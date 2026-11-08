#!/usr/bin/env bash
# nginx-site.conf şablonundan site dosyasını üretir (install-nginx.sh ve tests/deploy/nginx-site.sh
# kullanır): alan adı, uygulama portu ve Cloudflare aralıkları (cloudflare-ips.txt) yerine yazılır.
#   source docker/server/nginx-render.sh; render_site <alan-adı> <port> [şablon] [aralık-dosyası]

# Aralık dosyasındaki adresler (yorum ve boş satırlar hariç). Biçimi bozuk satır ya da eksik liste
# hatadır: boş bir liste bütün ziyaretçileri dışarıda bırakırdı.
cloudflare_ranges() {
  local file=$1 line count=0
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%%#*}
    line=${line//[[:space:]]/}
    [ -z "$line" ] && continue
    if ! [[ $line =~ ^[0-9a-fA-F:.]+/[0-9]{1,3}$ ]]; then
      echo "Hata: $file içinde geçersiz aralık: $line" >&2
      return 1
    fi
    printf '%s\n' "$line"
    count=$((count + 1))
  done < "$file"
  if [ "$count" -lt 10 ]; then
    echo "Hata: $file içinde yalnızca $count aralık var; liste eksik görünüyor." >&2
    return 1
  fi
}

render_site() {
  local domain=$1 port=$2 template=${3:-nginx-site.conf} ranges_file=${4:-cloudflare-ips.txt}
  local ranges line range
  ranges=$(cloudflare_ranges "$ranges_file") || return 1
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      *__CLOUDFLARE_REAL_IP__*)
        while IFS= read -r range; do printf '    set_real_ip_from %s;\n' "$range"; done <<< "$ranges" ;;
      *__CLOUDFLARE_GEO__*)
        while IFS= read -r range; do printf '    %s 1;\n' "$range"; done <<< "$ranges" ;;
      *)
        line=${line//__DOMAIN__/$domain}
        printf '%s\n' "${line//__PORT__/$port}" ;;
    esac
  done < "$template"
}
