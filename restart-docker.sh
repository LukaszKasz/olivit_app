#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"

if ! command -v docker >/dev/null 2>&1; then
    echo "Docker nie jest zainstalowany albo nie jest dostepny w PATH." >&2
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose (plugin 'docker compose') nie jest dostepny." >&2
    exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "Nie znaleziono pliku $COMPOSE_FILE." >&2
    exit 1
fi

echo "Przechodze do katalogu projektu: $ROOT_DIR"
cd "$ROOT_DIR"

echo "Zatrzymuje i usuwa kontenery biezacego stosu..."
docker compose down

echo "Buduje obrazy i uruchamiam kontenery w tle..."
docker compose up --build -d

echo "Aktualny status uslug:"
docker compose ps
