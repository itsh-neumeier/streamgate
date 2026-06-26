# StreamGate API

## Device

### POST /api/device/activate

Aktiviert ein Android-TV-Geraet per Code und gibt ein Device Token zurueck.

```json
{
  "activationCode": "AB12-CD34",
  "deviceName": "Wohnzimmer TV Stick",
  "deviceType": "android_tv",
  "appVersion": "0.1.0"
}
```

### POST /api/customer/login

Meldet die Kunden-Webapp mit den im Admin gepflegten Zugangsdaten an und gibt
ebenfalls ein Device Token zurueck.

```json
{
  "username": "max",
  "password": "streamgate",
  "deviceName": "Browser",
  "appVersion": "web-0.1.0"
}
```

### POST /api/device/heartbeat

Aktualisiert Online-Status, App-Version, aktuellen Sender und Playerstatus.

### GET /api/device/config

Liefert geraetespezifische Konfiguration.

### POST /api/device/logout

Schliesst aktive Sessions des Geraets.

## App

### GET /api/app/bootstrap

Liefert Kunde, Geraet, UI, Feature Flags, Limits und Branding.
`streamProfiles` enthaelt die Nutzerqualitaeten `HD` und `SD`.

## Channels

- `GET /api/channels`
- `GET /api/channels/favorites`
- `PUT /api/channels/favorites`
- `GET /api/channels/groups`

Mit Device Token liefert `GET /api/channels` nur Sender aus dem Paket des
zugeordneten Kunden. Ohne Device Token wird fuer interne MVP-Tests die aktive
Senderliste geliefert.

## Streams

- `POST /api/stream/open`
- `POST /api/stream/close`
- `GET /api/stream/session/:id`

`POST /api/stream/open` akzeptiert optional `quality`:

```json
{
  "channelId": "ard-hd",
  "deviceId": "dev_abc123",
  "quality": "hd"
}
```

Moegliche Werte:

- `hd`: Nutzeranzeige `HD`.
- `sd-480p`: Nutzeranzeige `SD`.

Die konkrete Streamerzeugung haengt von `STREAM_TRANSCODE_MODE` ab:
`streamgate` transcodiert per StreamGate-FFmpeg, `tvheadend-profile` nutzt die
konfigurierten TVHeadend-Profile fuer HD und SD.

Antwort:

```json
{
  "streamSessionId": "str_987",
  "url": "https://tv.example.local/stream/ticket/opaque-ticket",
  "expiresIn": 60,
  "mimeType": "video/mp2t",
  "quality": "hd",
  "qualityLabel": "HD"
}
```

Im Mock-Modus erzeugt StreamGate HLS-Test-URLs ueber den Proxy, ohne TVHeadend zu kontaktieren.

## EPG

- `GET /api/epg/now-next`
- `GET /api/epg/grid?from=&to=`

## DVR

- `GET /api/dvr/recordings`
- `GET /api/dvr/timers`
- `POST /api/dvr/timers`
- `DELETE /api/dvr/timers/:id`
- `DELETE /api/dvr/recordings/:id`

Alle DVR-Endpoints fuer Kunden erwarten ein Device Token. `POST /api/dvr/timers`
legt einen Timer fuer den Kunden an:

```json
{
  "channelId": "ard-hd",
  "title": "Tagesschau",
  "startTime": "2026-06-25T20:00:00.000Z",
  "endTime": "2026-06-25T20:15:00.000Z",
  "description": "optional"
}
```

StreamGate blockiert ueberlappende geplante Aufnahmen pro Kunde, damit nicht
zwei Aufnahmen gleichzeitig laufen. Der fuer TVHeadend verwendete Aufnahmeuser
wird in der Admin-Kundenverwaltung gepflegt.

## Admin

- `GET /admin/customers`
- `POST /admin/customers`
- `GET /admin/customers/:id`
- `PUT /admin/customers/:id`
- `POST /admin/customers/:id/activation-codes`
- `GET /admin/devices`
- `PUT /admin/devices/:id`
- `POST /admin/devices/:id/block`
- `POST /admin/devices/:id/reset`
- `GET /admin/channels`
- `PUT /admin/channels/:id`
- `GET /admin/packages`
- `POST /admin/packages`
- `PUT /admin/packages/:id`
- `POST /admin/streams/preview`
- `GET /admin/streams/active`
- `GET /admin/audit-log`

`POST /admin/streams/preview` startet einen Admin-Teststream ohne
Aktivierungscode, Device Token und Kunden-Streamlimit. Der Endpoint ist fuer den
Admin-Webplayer gedacht und erzeugt keine normale `StreamSession`.

`PUT /admin/customers/:id` akzeptiert neben Kundenstatus, Paket und Limits auch
`loginUsername`, `loginPassword`, `tvheadendUsername`, `tvheadendPassword`,
`tvheadendHdProfile`, `tvheadendSdProfile` und `dvrProfile`. Passwortfelder
werden nicht in Admin-Responses zurueckgegeben; stattdessen kommen
`loginPasswordSet` und `tvheadendPasswordSet`.
