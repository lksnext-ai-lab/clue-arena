# Docker Compose

La aplicacion puede ejecutarse con `docker compose` usando el `Dockerfile` existente.

## Requisitos

- Docker con Compose v2
- Un archivo `.env` basado en `.env.example`

## Arranque rapido

```bash
npm run docker:up
```

La app quedara disponible en `http://localhost:3000`.

## Comandos utiles

```bash
npm run docker:build
npm run docker:up:d
npm run docker:logs
npm run docker:down
```

## Persistencia

La base de datos SQLite se guarda en el volumen Docker `clue-arena-data`, montado en `/app/data`.

## Variables de entorno

`docker compose` carga variables desde `.env`.

Revisa especialmente:

- `AUTH_SECRET`
- `NEXT_PUBLIC_FIREBASE_*`
- `FIREBASE_*`
- `MATTIN_API_*`
- `MCP_AUTH_TOKEN`

Si no defines `DATABASE_URL`, Compose usara `/app/data/clue-arena.db` dentro del contenedor.
