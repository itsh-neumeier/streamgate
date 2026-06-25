# Stream Proxy

Der Stream-Proxy schuetzt interne TVHeadend-URLs und stellt temporaere StreamGate-URLs bereit.

## Konzept

1. App fordert `/api/stream/open` beim Backend an.
2. Backend validiert Kunde, Geraet, Paket und Streamlimit.
3. Backend erzeugt eine StreamSession und fordert intern ein kurzlebiges Stream-Ticket beim Connector an.
4. App spielt nur die daraus gebildete Proxy-URL ab.
5. Der Connector authentifiziert sich serverseitig bei TVHeadend und transcodiert den Stream je nach Qualitaetsprofil.

## Nginx MVP

Der MVP nutzt Nginx als Reverse Proxy fuer:

- `/api/*` und `/admin/*` zum Backend.
- `/stream/*` fuer tokenisierte Streamweiterleitung zum internen Connector.

Der Connector ist nicht oeffentlich geroutet. Das Backend fordert intern ein
zufaelliges, 60 Sekunden gueltiges Stream-Ticket an. Der Connector prueft das
Ticket, authentifiziert sich serverseitig bei TVHeadend und gibt nur einen
StreamGate-Stream aus. Ein gemeinsames Stream-Secret zwischen Backend und
Connector ist nicht erforderlich.

## Qualitaetsprofile

Fuer Clients gibt es zwei Nutzerprofile:

- `HD`: FFmpeg transcodiert serverseitig nach H.264/AAC in Originalaufloesung.
- `SD`: FFmpeg transcodiert serverseitig nach H.264/AAC mit 480p Videohoehe.

TVHeadend-Streams werden fuer Nutzer nicht als Passthrough ausgeliefert. Die
Standardumgebung nutzt VAAPI-Hardware-Encoding (`FFMPEG_TRANSCODER=vaapi`) mit
`/dev/dri/renderD128`. Fuer Hosts ohne VAAPI kann `FFMPEG_TRANSCODER=software`
gesetzt werden.

## Manuell mit VLC testen

1. Ein Geraet ueber `POST /api/device/activate` aktivieren und `deviceId` sowie
   `deviceToken` aufbewahren.
2. Einen Sender aus `GET /api/channels` auswaehlen.
3. `POST /api/stream/open` mit `Authorization: Bearer <deviceToken>`,
   `channelId`, `deviceId` und optional `quality` (`hd` oder `sd-480p`) aufrufen.
4. Die zurueckgegebene `url` innerhalb von 60 Sekunden in VLC ueber
   **Medien > Netzwerkstream oeffnen** starten.

Das Device Token gehoert nur in den API-Aufruf. Es darf weder an VLC noch an
TVHeadend weitergegeben werden.
