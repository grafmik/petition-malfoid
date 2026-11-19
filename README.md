# petition-malfoid

Pétition « Malfoid as the protagonist of GTA VI », servie sur https://gta6-malfoid.9mp.org (alias petition.9mp.org) (Coolify, VPS OVH).

- `server.mjs` : serveur Node sans dépendance, signatures en SQLite (`node:sqlite`) dans `$DATA_DIR` (volume persistant `/data`).
- `public/index.html` : la page.
- API : `GET /api/signatures` (compteur + 30 dernières, **sans e-mail**), `POST /api/sign` `{name,email,country,comment,consent,opt_in}`. E-mail obligatoire et unique (anti-doublon), consentement obligatoire, qui inclut l'accord pour recevoir des e-mails sur la pétition (`opt_in` toujours à 1). Chaque envoi doit contenir un lien de désinscription, promis sur la page. IP hachée (sha256 salé), 5 signatures/heure/IP, champ piège anti-robot.
- Exporter les signatures avec les e-mails : `tools/export.sh` (appelle `GET /api/export`, protégé par la variable `ADMIN_TOKEN` de Coolify ; jeton local dans `~/.config/petition-malfoid/admin_token` ; sans jeton valide, l’endpoint répond 404) → `signatures-AAAAMMJJ.csv` (git-ignoré, contient des données personnelles).
- Local : `node server.mjs` → http://localhost:3000
