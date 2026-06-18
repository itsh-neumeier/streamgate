# Sicherheitsmodell

## Grundsaetze

- Android-TV-Clients erhalten niemals TVHeadend-Credentials, TVHeadend-Admin-URLs oder interne Serverdaten.
- Device Tokens werden serverseitig nur gehasht gespeichert und koennen durch Device-Reset widerrufen werden.
- Aktivierungscodes sind einmalig, laufen ab und koennen widerrufen werden.
- Stream-URLs sind temporaer, sessiongebunden und duerfen keine echten Backend-Credentials enthalten.

## API-Schutz

- App-APIs unter `/api/*` nutzen signierte Device Tokens.
- Admin-APIs unter `/admin/*` sind fuer separaten Admin-Login und Rollen vorbereitet.
- CORS wird restriktiv ueber Env-Konfiguration gesteuert.
- Produktive Setups muessen HTTPS vor dem Proxy erzwingen.

## Sperrlogik

Ein Stream darf nicht geoeffnet werden, wenn:

- der Kunde nicht `active` ist,
- das Geraet nicht `active` ist,
- der Sender deaktiviert oder nicht im Kundenpaket enthalten ist,
- das Streamlimit erreicht ist,
- das Device Token widerrufen oder ungueltig ist.

## Audit

Admin-Aktionen werden als `AuditLog` modelliert. Der MVP legt das Schema und API-Flaechen an; persistentes Audit-Logging wird in der naechsten Ausbaustufe verdrahtet.
