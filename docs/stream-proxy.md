# Stream Proxy

Der Stream-Proxy schuetzt interne TVHeadend-URLs und stellt temporaere StreamGate-URLs bereit.

## Konzept

1. App fordert `/api/stream/open` beim Backend an.
2. Backend validiert Kunde, Geraet, Paket und Streamlimit.
3. Backend erzeugt eine StreamSession und signiert eine kurzlebige Proxy-URL.
4. App spielt nur diese Proxy-URL ab.
5. Proxy/Backend koennen die Session vor Weiterleitung pruefen.

## Nginx MVP

Der MVP nutzt Nginx als Reverse Proxy fuer:

- `/api/*` und `/admin/*` zum Backend.
- `/stream/*` fuer tokenisierte Streamweiterleitung zum internen Connector.

Der Connector ist nicht oeffentlich geroutet. Er prueft HMAC-Signatur und
Ablaufzeit der Stream-URL, authentifiziert sich serverseitig bei TVHeadend und
leitet den MPEG-TS-Datenstrom ohne Offenlegung der TVHeadend-Zugangsdaten weiter.

## Manuell mit VLC testen

1. Ein Geraet ueber `POST /api/device/activate` aktivieren und `deviceId` sowie
   `deviceToken` aufbewahren.
2. Einen Sender aus `GET /api/channels` auswaehlen.
3. `POST /api/stream/open` mit `Authorization: Bearer <deviceToken>`,
   `channelId` und `deviceId` aufrufen.
4. Die zurueckgegebene `url` innerhalb von 60 Sekunden in VLC ueber
   **Medien > Netzwerkstream oeffnen** starten.

Das Device Token gehoert nur in den API-Aufruf. Es darf weder an VLC noch an
TVHeadend weitergegeben werden.
