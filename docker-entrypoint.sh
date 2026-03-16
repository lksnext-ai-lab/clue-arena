#!/bin/sh
set -eu

if [ "${SKIP_DB_MIGRATIONS:-false}" != "true" ]; then
  node --import tsx src/lib/db/migrate.ts
fi

exec "$@"
