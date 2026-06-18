# GHCR Publishing

GitHub Actions veroeffentlichen Container nach `ghcr.io/itsh-neumeier`.

## Rechte

Workflows benoetigen:

```yaml
permissions:
  contents: read
  packages: write
```

## Images

- `ghcr.io/itsh-neumeier/streamgate-backend`
- `ghcr.io/itsh-neumeier/streamgate-admin`
- `ghcr.io/itsh-neumeier/streamgate-proxy`
- `ghcr.io/itsh-neumeier/streamgate-tvheadend-connector`

## Tags

Bei Push auf `main`:

- `latest`
- `main`
- Commit-SHA

Bei Tags wie `v0.1.0`:

- `v0.1.0`
- Commit-SHA
