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
- `/connector/*` zum TVHeadend-Connector.
- `/stream/*` fuer spaetere tokenisierte Streamweiterleitung.

Die eigentliche Streamtoken-Pruefung ist als Backend/Proxy-Erweiterung vorbereitet.
