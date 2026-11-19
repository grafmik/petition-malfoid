# petition-malfoid

Pétition humoristique « Make Malfoid the heroine of GTA VI », servie sur https://petition.9mp.org (Coolify, VPS OVH).

- `server.mjs` : serveur Node sans dépendance, signatures en SQLite (`node:sqlite`) dans `$DATA_DIR` (volume persistant `/data`).
- `public/index.html` : la page.
- API : `GET /api/signatures` (compteur + 30 dernières), `POST /api/sign` `{name,country,comment}`. Pas d'e-mail collecté ; IP hachée (sha256 salé) pour l'anti-doublon, 5 signatures/heure/IP, champ piège anti-robot.
- Local : `node server.mjs` → http://localhost:3000
- Lire les signatures sur le VPS : `docker exec <conteneur> node -e "const {DatabaseSync}=require('node:sqlite');console.log(new DatabaseSync('/data/signatures.db').prepare('select * from signatures').all())"`
