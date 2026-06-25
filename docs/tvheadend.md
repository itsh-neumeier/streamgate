# TVHeadend Connector

Der Connector kapselt TVHeadend serverseitig. Clients sprechen nie direkt mit TVHeadend.

## Aufgaben

- Kanaele aus TVHeadend abrufen.
- EPG/Now-Next abrufen.
- DVR-Aufnahmen abrufen.
- DVR-Timer erstellen und loeschen.
- TVHeadend-User-Mapping vorbereiten.
- Interne Stream-Tickets erzeugen.
- TVHeadend-Streams per FFmpeg nach H.264/AAC transcodieren.
- Mock-Modus bereitstellen.

## Umgebungsvariablen

- `MOCK_MODE=true`
- `TVHEADEND_BASE_URL`
- `TVHEADEND_USERNAME`
- `TVHEADEND_PASSWORD`
- `TVHEADEND_DEFAULT_PROFILE`
- `FFMPEG_TRANSCODER=vaapi`
- `VAAPI_DEVICE=/dev/dri/renderD128`
- `HD_VIDEO_BITRATE=5500k`
- `SD_VIDEO_BITRATE=1400k`

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

## Streamausgabe

Fuer Nutzer gibt es zwei Qualitaeten:

- `HD`: H.264/AAC in Originalaufloesung.
- `SD`: H.264/AAC in 480p.

Beide Profile laufen ueber FFmpeg. Im VAAPI-Modus wird `h264_vaapi` genutzt,
im Software-Modus `libx264`. Rohe TVHeadend-Stream-URLs werden nicht an Clients
weitergegeben.

## Mock-Modus

Im Mock-Modus gibt der Connector deterministische Beispielkanaele, EPG-Daten, leere DVR-Listen und HLS-Teststreams zurueck. Dadurch sind Backend, Admin und Android-TV-App ohne TVHeadend testbar.
