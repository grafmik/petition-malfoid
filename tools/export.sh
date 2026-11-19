#!/bin/bash
# Exporte les signatures (e-mails compris) de la pétition en ligne vers un CSV local.
# Usage : tools/export.sh [fichier.csv]   (défaut : signatures-AAAAMMJJ.csv, git-ignoré)
# Passe par l'alias ssh « vps » et le conteneur Coolify de l'app jtsudl1ff0uwgjavfxz73lgo.
set -euo pipefail
OUT=${1:-signatures-$(date +%Y%m%d).csv}
ssh vps 'C=$(docker ps --filter "name=jtsudl1ff0uwgjavfxz73lgo" --format "{{.Names}}" | head -1)
[ -n "$C" ] || { echo "conteneur introuvable" >&2; exit 1; }
docker exec "$C" node -e "
const {DatabaseSync}=require(\"node:sqlite\");
const rows=new DatabaseSync(\"/data/signatures.db\",{readOnly:true}).prepare(\"SELECT id,created_at,name,email,country,opt_in,comment FROM signatures ORDER BY id\").all();
const q=v=>{v=String(v??\"\");return /[\",\n]/.test(v)?\"\\\"\"+v.replace(/\"/g,\"\\\"\\\"\")+\"\\\"\":v};
console.log(\"id,created_at,name,email,country,opt_in,comment\");
for(const r of rows)console.log([r.id,r.created_at,r.name,r.email,r.country,r.opt_in,r.comment].map(q).join(\",\"));
"' > "$OUT"
echo "$(($(wc -l < "$OUT") - 1)) signatures → $OUT"
