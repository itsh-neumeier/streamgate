# Deployment

## Lokal

```bash
docker compose -f deploy/docker-compose.yml up --build
```

## Produktionsnah

```bash
docker compose -f deploy/docker-compose.prod.yml up -d
```

## Healthchecks

- Backend: `GET /health`
- Admin: `GET /`
- Connector: `GET /health`
- Proxy: `GET /health`
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`

## Produktionshinweise

- HTTPS vor `streamgate-proxy` erzwingen.
- Echte Secrets nicht in Compose-Dateien speichern.
- Datenbank-Backups und Migrationen separat betreiben.
- Admin-Login und Rollenmodell vor produktivem Einsatz fertigstellen.
- TVHeadend nur intern erreichbar machen.
- Fuer VAAPI-Hardware-Encoding muss der Connector Zugriff auf
  `/dev/dri/renderD128` bekommen. In Portainer ist das ueber
  `VAAPI_RENDER_DEVICE=/dev/dri/renderD128` vorbereitet.
- Ohne VAAPI kann `FFMPEG_TRANSCODER=software` genutzt werden. Dann sollte der
  Device-Mount aus der Stack-Datei entfernt werden.
