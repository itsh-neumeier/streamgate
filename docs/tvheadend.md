# TVHeadend Connector

Der Connector kapselt TVHeadend serverseitig. Clients sprechen nie direkt mit TVHeadend.

## Aufgaben

- Kanaele aus TVHeadend abrufen.
- EPG/Now-Next abrufen.
- DVR-Aufnahmen abrufen.
- DVR-Timer erstellen und loeschen.
- TVHeadend-User-Mapping vorbereiten.
- Interne Stream-URLs erzeugen.
- Mock-Modus bereitstellen.

## Umgebungsvariablen

- `MOCK_MODE=true`
- `TVHEADEND_BASE_URL`
- `TVHEADEND_USERNAME`
- `TVHEADEND_PASSWORD`
- `TVHEADEND_DEFAULT_PROFILE`

## Mock-Modus

Im Mock-Modus gibt der Connector deterministische Beispielkanaele, EPG-Daten, leere DVR-Listen und HLS-Teststreams zurueck. Dadurch sind Backend, Admin und Android-TV-App ohne TVHeadend testbar.
