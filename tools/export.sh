#!/bin/bash
# Exporte les signatures (e-mails compris) de la pétition en ligne vers un CSV local.
# Usage : tools/export.sh [fichier.csv]   (défaut : signatures-AAAAMMJJ.csv, git-ignoré)
# Jeton dans ~/.config/petition-malfoid/admin_token (même valeur que la variable ADMIN_TOKEN de l'app Coolify).
set -euo pipefail
OUT=${1:-signatures-$(date +%Y%m%d).csv}
TOKEN_FILE=~/.config/petition-malfoid/admin_token
curl -fsS -H "Authorization: Bearer $(cat "$TOKEN_FILE")" https://gta6-malfoid.9mp.org/api/export -o "$OUT"
echo "$(($(wc -l < "$OUT") - 1)) signatures → $OUT"
