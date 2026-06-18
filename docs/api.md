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

### POST /api/device/heartbeat

Aktualisiert Online-Status, App-Version, aktuellen Sender und Playerstatus.

### GET /api/device/config

Liefert geraetespezifische Konfiguration.

### POST /api/device/logout

Schliesst aktive Sessions des Geraets.

## App

### GET /api/app/bootstrap

Liefert Kunde, Geraet, UI, Feature Flags, Limits und Branding.

## Channels

- `GET /api/channels`
- `GET /api/channels/favorites`
- `PUT /api/channels/favorites`
- `GET /api/channels/groups`

## Streams

- `POST /api/stream/open`
- `POST /api/stream/close`
- `GET /api/stream/session/:id`

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
- `GET /admin/streams/active`
- `GET /admin/audit-log`
