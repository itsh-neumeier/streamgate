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

Bei `MOCK_MODE=false` liest der Connector die Sender ueber
`/api/channel/grid` ein. Ist dieser Endpoint fuer den Benutzer nicht
freigegeben, verwendet der Connector automatisch `/playlist/channels`.
Der konfigurierte TVHeadend-Benutzer benoetigt mindestens Streaming-Rechte
fuer die freigegebenen Sender. `TVHEADEND_BASE_URL` muss aus dem
Connector-Container erreichbar sein; `localhost` verweist dort auf den
Connector selbst.

Der Connector gibt nur normalisierte Senderdaten an StreamGate weiter.
TVHeadend-URL und Zugangsdaten werden nicht an Admin- oder TV-Clients
ausgeliefert.

## Mock-Modus

Im Mock-Modus gibt der Connector deterministische Beispielkanaele, EPG-Daten, leere DVR-Listen und HLS-Teststreams zurueck. Dadurch sind Backend, Admin und Android-TV-App ohne TVHeadend testbar.
