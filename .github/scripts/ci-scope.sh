#!/usr/bin/env bash
# Hafif CI kararı (.github/workflows/ci.yml): yalnızca labs/rooms/ ve docs/ değiştiyse full=false.
# PR'da HEAD birleştirme denemesidir, HEAD^1 hedef dalın ucu; main'e girişte BEFORE önceki uçtur.
# Fark bulunamazsa (sığ geçmiş, yeni dal, boş fark) her zaman full=true: şüphede her şey çalışır.
set -euo pipefail

base=""
if [ "${GITHUB_EVENT_NAME:-}" = pull_request ]; then
  base=HEAD^1
elif [ -n "${BEFORE:-}" ] && [ "${BEFORE//0/}" != "" ]; then
  git fetch -q --depth=1 origin "$BEFORE" 2> /dev/null && base="$BEFORE"
fi

full=true
files=""
if [ -n "$base" ] && files=$(git diff --name-only "$base" HEAD 2> /dev/null) && [ -n "$files" ]; then
  if ! grep -qvE '^(labs/rooms|docs)/' <<< "$files"; then full=false; fi
fi

echo "Değişen dosyalar:"
printf '  %s\n' "${files:-(bulunamadı)}"
echo "Tam CI: $full"
echo "full=$full" >> "${GITHUB_OUTPUT:-/dev/null}"
