#!/usr/bin/env bash
# Filtr ro'yxatlarini (EasyList, RuAdList, AdGuard) yangilab, kengaytma qoidalarini qayta yaratadi.
# Talablar: git, Node.js 18+. Ixtiyoriy: Playwright (selektorlarni Chromium'da tekshirish uchun).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p lists
cd lists

fetch() {
  local repo=$1 dir=$2
  if [ -d "$dir/.git" ]; then
    git -C "$dir" fetch -q --depth 1 origin HEAD && git -C "$dir" reset -q --hard FETCH_HEAD
  else
    git clone -q --depth 1 "$repo" "$dir"
  fi
}

echo "→ EasyList"
fetch https://github.com/easylist/easylist.git easylist
echo "→ RuAdList"
fetch https://github.com/easylist/ruadlist.git ruadlist
echo "→ AdGuard (Base + Cyrillic)"
if [ ! -d AdguardFilters/.git ]; then
  git clone -q --depth 1 --filter=blob:none --sparse https://github.com/AdguardTeam/AdguardFilters.git AdguardFilters
  git -C AdguardFilters sparse-checkout set BaseFilter/sections CyrillicFilters
else
  git -C AdguardFilters fetch -q --depth 1 origin HEAD && git -C AdguardFilters reset -q --hard FETCH_HEAD
fi

cd ..
node build-filters.mjs lists ../extension
echo "Tayyor. Brauzerda kengaytmani qayta yuklang (browser://extensions → ⟳)."
