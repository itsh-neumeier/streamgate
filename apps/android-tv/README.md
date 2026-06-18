# StreamGate Android-TV

Android-TV-Client fuer StreamGate.

## Build

Mit Android Studio oeffnen oder mit lokal installiertem Gradle bauen:

```bash
cd apps/android-tv
gradle :app:assembleDebug
```

Der API-Endpunkt kann per Gradle Property ueberschrieben werden:

```bash
gradle :app:assembleDebug -PSTREAMGATE_API_BASE_URL=http://192.168.1.10:3000
```

## MVP-Funktionen

- Aktivierungscode-Screen.
- Device Token Storage.
- Bootstrap- und Channel-API.
- Live-TV-Screen mit Media3/ExoPlayer.
- Senderliste und Mini-Guide Overlays.
- 300-ms-Zapping-Debounce fuer Pfeil hoch/runter.
- Cache der letzten gueltigen Bootstrap-Konfiguration.
