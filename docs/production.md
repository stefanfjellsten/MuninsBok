# Driftsättning i produktion

Denna guide beskriver hur du kör Munins bok i en produktionsmiljö med TLS, backup, övervakning och säkerhet.

---

## Innehåll

1. [Förberedelser](#förberedelser)
2. [Miljövariabler](#miljövariabler)
3. [TLS / HTTPS med nginx](#tls--https-med-nginx)
4. [Backup & återställning](#backup--återställning)
5. [Övervakning](#övervakning)
6. [Säkerhetsrekommendationer](#säkerhetsrekommendationer)
7. [Databasmigreringar](#databasmigreringar)

---

## Förberedelser

- **Node.js 20+** och **pnpm 8+** (om du kör utan Docker)
- **PostgreSQL 16+** med ett dedikerat databasanvändarkonto
- **Docker & Docker Compose** (rekommenderat)
- Eget domännamn med DNS pekat mot servern
- TLS-certifikat (Let's Encrypt / Certbot rekommenderas)

---

## Miljövariabler

Skapa `.env` baserad på `.env.example`:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://user:lösenord@localhost:5432/muninsbok
HOST=0.0.0.0
PORT=3000
CORS_ORIGIN=https://din-domän.se
JWT_SECRET=en-lång-slumpmässig-hemlighet
```

Generera `JWT_SECRET` med:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Viktiga inställningar i produktion

| Variabel | Krävs | Beskrivning |
|----------|-------|-------------|
| `NODE_ENV` | Nej (default: `development`) | Sätts till `production` — styr loggformat och varningar |
| `DATABASE_URL` | **Ja** | PostgreSQL-anslutningssträng |
| `JWT_SECRET` | **Rekommenderat** | Aktiverar JWT-autentisering (register/login). **Varning visas om den saknas i produktion.** |
| `CORS_ORIGIN` | Rekommenderat | Frontend-URL (t.ex. `https://bok.example.se`) |
| `HOST` | Nej (default: `0.0.0.0`) | Lyssningsadress |
| `PORT` | Nej (default: `3000`) | Lyssningsport |
| `API_KEY` | Nej | Enkel delad-hemlighet-auth. Ignoreras när `JWT_SECRET` är satt. |

Servern validerar vid start att `DATABASE_URL` finns — saknas den avslutas processen direkt med felmeddelande.

---

## TLS / HTTPS med nginx

I produktion ska all trafik gå via HTTPS. Lägg en **nginx reverse proxy** framför Docker-stacken.

### 1. Installera Certbot & hämta certifikat

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d bok.example.se
```

### 2. nginx-konfiguration

Spara som `/etc/nginx/sites-available/muninsbok`:

```nginx
# Omdirigera HTTP → HTTPS
server {
    listen 80;
    server_name bok.example.se;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bok.example.se;

    ssl_certificate     /etc/letsencrypt/live/bok.example.se/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bok.example.se/privkey.pem;

    # Säkerhetshuvuden
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # Frontend (statiska filer)
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Filuppladdning — höj gräns vid behov
        client_max_body_size 10m;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3000;
    }
}
```

### 3. Aktivera och testa

```bash
sudo ln -s /etc/nginx/sites-available/muninsbok /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Automatisk certifikatsförnyelse

Certbot installerar en timer automatiskt. Verifiera:

```bash
sudo systemctl status certbot.timer
```

---

## Backup & återställning

### Daglig backup med pg_dump

Skapa ett skript `/opt/muninsbok/backup.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/muninsbok/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/muninsbok_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# Om PostgreSQL körs i Docker:
docker exec muninsbok-db pg_dump -U muninsbok muninsbok | gzip > "$BACKUP_FILE"

# Om PostgreSQL körs lokalt:
# pg_dump -U muninsbok muninsbok | gzip > "$BACKUP_FILE"

# Ta bort gamla backuper
find "$BACKUP_DIR" -name "muninsbok_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup klar: ${BACKUP_FILE}"
```

Gör skriptet körbart och lägg in som cron-jobb:

```bash
chmod +x /opt/muninsbok/backup.sh

# Daglig backup kl 02:00
echo "0 2 * * * root /opt/muninsbok/backup.sh >> /var/log/muninsbok-backup.log 2>&1" \
  | sudo tee /etc/cron.d/muninsbok-backup
```

### Återställning

```bash
# Stoppa API:t
docker compose stop api

# Återställ dump
gunzip -c /opt/muninsbok/backups/muninsbok_20260101_020000.sql.gz \
  | docker exec -i muninsbok-db psql -U muninsbok muninsbok

# Starta API:t igen
docker compose start api
```

### Backup av uppladdade dokument

Bifogade filer lagras i Docker-volymen `uploads_data`. Säkerhetskopiera den också:

```bash
# Kopiera volymen
docker run --rm -v muninsbok_uploads_data:/data -v /opt/muninsbok/backups:/backup \
  alpine tar czf /backup/uploads_${TIMESTAMP}.tar.gz -C /data .
```

### Testa backup regelbundet

> **Viktig princip**: En backup som inte har testats är ingen backup.

Återställ till en testdatabas regelbundet för att verifiera att backupen fungerar:

```bash
# Skapa test-DB och återställ
docker exec muninsbok-db createdb -U muninsbok muninsbok_test
gunzip -c backup.sql.gz | docker exec -i muninsbok-db psql -U muninsbok muninsbok_test

# Verifiera
docker exec muninsbok-db psql -U muninsbok muninsbok_test -c "SELECT count(*) FROM vouchers;"

# Rensa
docker exec muninsbok-db dropdb -U muninsbok muninsbok_test
```

---

## Övervakning

### Health check

API:et exponerar `/health` som returnerar:

```json
{
  "status": "ok",
  "database": "ok",
  "timestamp": "2026-02-18T12:00:00.000Z"
}
```

Om databasen inte svarar returneras `"status": "degraded"`.

### Extern övervakning (exempel med curl)

```bash
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://bok.example.se/health)
if [ "$RESPONSE" != "200" ]; then
  echo "ALARM: Munins bok health check misslyckades (HTTP $RESPONSE)" | \
    mail -s "Muninsbok-larm" admin@example.se
fi
```

### Docker-loggar

```bash
# Följ API-loggar i realtid
docker compose logs -f api

# Senaste 100 raderna
docker compose logs --tail 100 api
```

---

## Säkerhetsrekommendationer

1. **Sätt alltid `API_KEY`** i produktion — utan den är API:et öppet för alla.
2. **Använd starka databaslösenord** — inte standardvärdet `muninsbok`.
3. **Begränsa nätverksåtkomst** — PostgreSQL ska bara vara tillgänglig från API-containern, aldrig publikt.
4. **Kör databasbackup dagligen** och testa återställning regelbundet.
5. **Uppdatera Docker-images regelbundet** — kör `docker compose pull && docker compose up -d`.
6. **Håll `NODE_ENV=production`** — det styr loggformat och kan i framtiden påverka prestanda.
7. **Aktivera brandväggsregler** — bara port 80/443 ska vara öppna publikt.

### docker-compose.override.yml (produktion)

Skapa för att anpassa produktionsinställningar:

```yaml
version: "3.8"
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ett-starkt-slumpmässigt-lösenord
    # Stäng extern port i produktion
    ports: !reset []

  api:
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://muninsbok:ett-starkt-slumpmässigt-lösenord@postgres:5432/muninsbok
      API_KEY: en-lång-hemlig-api-nyckel
      CORS_ORIGIN: https://bok.example.se
    restart: always
```

---

## Databasmigreringar

Projektet använder **Prisma** för databasschema. Det finns två kommandon som hanterar schemaändringar — de används i olika sammanhang:

| Kommando | Miljö | Beskrivning |
|----------|-------|-------------|
| `prisma db push` | **Utveckling** | Synkroniserar schemat direkt utan att skapa migreringsfiler. Snabbt och enkelt under utveckling. |
| `prisma migrate deploy` | **Produktion** | Kör alla väntande migreringsfiler i ordning. Säkert och repeterbart. |

### Workflow: skapa en ny migrering

1. **Ändra schemat** i `packages/db/prisma/schema.prisma`

2. **Skapa migreringsfil:**

   ```bash
   pnpm --filter @muninsbok/db exec prisma migrate dev --name beskrivande-namn
   ```

   Detta skapar en SQL-fil under `packages/db/prisma/migrations/` och uppdaterar den lokala databasen.

3. **Committa** migreringsfilen tillsammans med schemaändringen.

4. **Vid deploy** körs migreringar automatiskt — API-containerns CMD kör `prisma migrate deploy` innan servern startar (se `apps/api/Dockerfile`).

### Viktigt

- Kör **aldrig** `prisma db push` mot produktionsdatabasen — den kan förstöra data vid destruktiva ändringar.
- Testa migreringar lokalt med `prisma migrate dev` innan deploy.
- Ta alltid backup före migrering i produktion (se [Backup & återställning](#backup--återställning)).
