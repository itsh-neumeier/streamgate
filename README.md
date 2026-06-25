# StreamGate

StreamGate ist eine leichtgewichtige White-Label-TV-Plattform fuer Android-TV-Sticks. Die Android-TV-App ist nur ein Client; die fachliche Wahrheit liegt im StreamGate-Backend. TVHeadend bleibt ein internes Backend fuer Live-TV, EPG und DVR und wird niemals direkt gegenueber Endgeraeten offengelegt.

## Komponenten

- `apps/backend`: NestJS Middleman-API mit Device Activation, Bootstrap, Sendern, Streams, Heartbeat und Admin-API.
- `apps/admin`: React/Vite Admin-Oberflaeche fuer Kunden, Geraete, Sender, Pakete, Streams, Webplayer und Branding.
- `apps/android-tv`: Kotlin Android-TV-App-Grundgeruest mit Aktivierung, Live-TV und Zapping-Debounce.
- `services/tvheadend-connector`: serverseitiger TVHeadend-Adapter mit Mock-Modus und FFmpeg H.264-Transcoding.
- `services/proxy`: Nginx-basierter API- und Stream-Proxy fuer temporaere Stream-URLs.
- `deploy`: lokale und produktionsnahe Compose-Dateien plus Nginx-Konfiguration.

## Lokale Entwicklung

```bash
cp .env.example .env
docker compose -f deploy/docker-compose.yml up --build
```

Wichtige lokale URLs:

- Backend: `http://localhost:3000`
- Admin: `http://localhost:8080`
- Proxy: `http://localhost:8088`
- TVHeadend-Connector: `http://localhost:3100`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Backend starten

```bash
cd apps/backend
npm install
npm run prisma:generate
npm run start:dev
```

Der MVP laeuft standardmaessig im Mock-Modus. Die REST-Endpunkte sind unter `/api/*`, Admin-Endpunkte unter `/admin/*`.

## Android-TV-App

Das Android-Projekt liegt in `apps/android-tv`. Es nutzt Kotlin, Jetpack Compose und AndroidX Media3. Der Client speichert ein Device Token, cached die letzte gueltige Bootstrap-Konfiguration lokal und fordert Streams ausschliesslich ueber StreamGate an. Die Qualitaetseinstellung zeigt fuer Nutzer nur `HD` und `SD`.

## Webplayer

Der Admin-Container enthaelt einen Webplayer-Tab. Er wird wie ein Client per
Admin-Preview-Endpunkt gestartet und braucht keinen Aktivierungscode, kein
Device Token und kein Kunden-Streamlimit. Der Browser sieht keine TVHeadend-URL
und keine Credentials.

## Transcoding

Bei realem TVHeadend-Betrieb liefert StreamGate fuer Nutzer keine
TVHeadend-Passthrough-Streams aus. Es gibt zwei Betriebsarten:

- `STREAM_TRANSCODE_MODE=streamgate`: Der Connector transcodiert selbst per
  FFmpeg. `HD` ist H.264/AAC in Originalaufloesung, `SD` ist H.264/AAC in 480p.
- `STREAM_TRANSCODE_MODE=tvheadend-profile`: Der Connector nutzt die
  TVHeadend-Profile `TVHEADEND_HD_PROFILE` und `TVHEADEND_SD_PROFILE`, gibt aber
  weiterhin nur eine temporaere StreamGate-URL an Clients aus.

Standard fuer StreamGate-FFmpeg in Portainer/Produktion ist VAAPI
(`FFMPEG_TRANSCODER=vaapi`) mit `/dev/dri/renderD128`. Fuer Hosts ohne
Hardware-Encoding kann `FFMPEG_TRANSCODER=software` verwendet werden. Wenn
TVHeadend-Profile Matroska ausgeben, kann VLC/Android funktionieren, waehrend
Browser je nach Container/Codec ablehnen; fuer den Admin-Webplayer sind
MPEG-TS oder HLS robuster.

## GHCR Images

Die GitHub Actions bauen und veroeffentlichen folgende Images:

- `ghcr.io/itsh-neumeier/streamgate-backend`
- `ghcr.io/itsh-neumeier/streamgate-admin`
- `ghcr.io/itsh-neumeier/streamgate-proxy`
- `ghcr.io/itsh-neumeier/streamgate-tvheadend-connector`

Tags:

- `latest`
- `main`
- Commit-SHA
- Semver-Tags wie `v0.1.0`

## Produktionsnahes Deployment

```bash
cp .env.example .env
docker compose -f deploy/docker-compose.prod.yml up -d
```

Produktive Deployments muessen HTTPS vor den Proxy setzen, Secrets per sicherem Secret Store bereitstellen und Admin-Auth aktivieren.

## TVHeadend

TVHeadend-Zugangsdaten werden nur in Backend/Connector-Umgebungsvariablen konfiguriert. Android-App und Webplayer erhalten nur temporaere StreamGate-Stream-URLs. Senderpakete werden in der Admin-Oberflaeche zusammengestellt und Kunden zugewiesen; Device-Streams duerfen nur Sender aus dem Kundenpaket oeffnen.

## Sicherheit

- Keine Secrets committen; `.env.example` enthaelt nur Platzhalter.
- Device Tokens werden nur gehasht serverseitig gespeichert.
- Aktivierungscodes laufen ab und sind widerrufbar.
- Gesperrte Kunden oder Geraete duerfen keine Streams oeffnen.
- Admin-APIs sind fuer spaetere separate Admin-Authentifizierung vorbereitet.

## Roadmap

- Produktionsreife Admin-Authentifizierung.
- Streamlimits mit Redis-backed Session Accounting.
- Vollstaendige TVHeadend-Synchronisation.
- DVR-Proxy und EPG-Grid.
- White-Label Branding je Tenant.
- Android Release Pipeline und optionaler Android-Builder-Container.
