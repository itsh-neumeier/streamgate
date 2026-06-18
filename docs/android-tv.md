# Android-TV-App

Die Android-TV-App ist ein reiner StreamGate-Client. Sie speichert keine TVHeadend-Zugangsdaten und nutzt keine direkte TVHeadend-URL.

## Module

- `ActivationScreen`
- `HomeScreen`
- `LiveTvScreen`
- `PlayerView`
- `ChannelListOverlay`
- `MiniGuideOverlay`
- `EpgScreen`
- `RecordingsScreen`
- `SettingsScreen`
- `ApiClient`
- `TokenStorage`
- `ChannelRepository`
- `EpgRepository`
- `DvrRepository`
- `StreamRepository`
- `RemoteControlHandler`

## Remote Control

- Pfeil hoch: naechster Sender
- Pfeil runter: vorheriger Sender
- OK: Senderliste
- Pfeil links/rechts: Mini-Guide
- Zurueck: Overlay schliessen oder Home
- Menue: Hauptmenue
- Ziffern: direkter Sendernummern-Puffer

## Zapping

Mehrere Hoch/Runter-Eingaben werden gebuendelt. Erst nach 300 ms ohne weitere Eingabe oeffnet die App den neuen Stream. Waehrenddessen zeigt die UI Sendername und Now/Next aus dem lokalen Cache.

## Offline-Strategie

Die letzte gueltige Bootstrap-Konfiguration wird lokal gespeichert. Bei kurzzeitig nicht erreichbarem Backend startet die App eingeschraenkt mit Cache-Daten; neue Streams werden trotzdem nur mit gueltigem StreamGate Token geoeffnet.
