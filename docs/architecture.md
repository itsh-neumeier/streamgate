# StreamGate Architektur

## Zielbild

StreamGate trennt konsequent Client, Middleman-Verwaltung und TVHeadend. Android-TV-Clients sprechen nur mit StreamGate. StreamGate prueft Kundenstatus, Geraetestatus, Paketberechtigungen und Streamlimits, bevor eine temporaere Stream-URL erzeugt wird.

```mermaid
flowchart LR
  tv["Android-TV-App"] -->|Device Token, REST| proxy["streamgate-proxy"]
  admin["Admin Browser"] -->|Admin REST| proxy
  proxy --> backend["streamgate-backend"]
  backend --> db[("PostgreSQL")]
  backend --> redis[("Redis")]
  backend --> connector["tvheadend-connector"]
  connector --> tvh["TVHeadend intern"]
  proxy -->|tokenisierte Streams| connector
```

## Komponentenabgrenzung

- `streamgate-backend`: fuehrt Kunden, Geraete, Aktivierungscodes, Pakete, Sender, StreamSessions, DVR-Proxy-Metadaten, Bootstrap und Admin-API.
- `streamgate-admin`: operative Verwaltungsoberflaeche. Keine direkte TVHeadend-Verbindung.
- `streamgate-android-tv`: reiner Client mit TokenStorage, lokaler letzter gueltiger Konfiguration und Media3-Player.
- `streamgate-tvheadend-connector`: kapselt TVHeadend-API, Mock-Daten und interne Stream-URL-Erzeugung.
- `streamgate-proxy`: HTTPS-Terminierung im Zielbetrieb, API-Routing und Stream-Proxy fuer temporaere URLs.

## Datenfluss: Aktivierung

```mermaid
sequenceDiagram
  participant App as Android-TV-App
  participant API as StreamGate Backend
  participant DB as PostgreSQL
  App->>API: POST /api/device/activate
  API->>DB: Aktivierungscode pruefen
  API->>DB: Geraet binden, Token-Hash speichern
  API-->>App: deviceId, deviceToken, customerId
```

## Datenfluss: Stream oeffnen

```mermaid
sequenceDiagram
  participant App
  participant API as Backend
  participant Connector as TVHeadend Connector
  participant Proxy
  App->>API: POST /api/stream/open
  API->>API: Kunde, Geraet, Paket, Streamlimit pruefen
  API->>Connector: interne Stream-Quelle anfragen
  Connector-->>API: interne URL
  API->>API: StreamSession erstellen
  API-->>App: temporaere Proxy-URL
  App->>Proxy: HLS abrufen
  Proxy->>Connector: Stream tokenisiert weiterleiten
```

## Service-Entscheidung

Der TVHeadend-Connector ist als eigener Service angelegt, damit TVHeadend-spezifische API-Details, Credentials und spaetere User-Mapping-Logik isoliert bleiben. Das Backend haelt die fachlichen Entscheidungen. Der Proxy ist eigenstaendig, weil Stream-Auslieferung und API-Verwaltung unterschiedliche Skalierungsprofile haben.
