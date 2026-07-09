#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
PROJECTS_DIR="$(cd "$ROOT_DIR/.." && pwd)"
NGINX_DIR="$PROJECTS_DIR/nginx"
NGINX_RESTART_SCRIPT="$NGINX_DIR/restart-docker.sh"

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

if [[ ! -d "$NGINX_DIR" ]]; then
    echo "Nie znaleziono katalogu nginx: $NGINX_DIR." >&2
    exit 1
fi

if [[ ! -f "$NGINX_RESTART_SCRIPT" ]]; then
    echo "Nie znaleziono skryptu restartu nginx: $NGINX_RESTART_SCRIPT." >&2
    exit 1
fi

echo "Restartuje nginx..."
(
    cd "$NGINX_DIR"
    bash "$NGINX_RESTART_SCRIPT"
)

echo "Przechodze do katalogu projektu: $ROOT_DIR"
cd "$ROOT_DIR"

echo "Zatrzymuje i usuwa kontenery biezacego stosu..."
docker compose down

echo "Buduje obrazy i uruchamiam kontenery w tle..."
docker compose up --build -d "$@"

echo "Aktualny status uslug:"
docker compose ps
