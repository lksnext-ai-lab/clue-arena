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

Las variables `NEXT_PUBLIC_*` tambien se pasan al `build` de la imagen para que la configuracion cliente de Next.js quede embebida correctamente.

Revisa especialmente:

- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_FIREBASE_*`
- `FIREBASE_*`
- `MATTIN_API_*`
- `MCP_AUTH_TOKEN`

Si no defines `DATABASE_URL`, Compose usara `/app/data/clue-arena.db` dentro del contenedor.
