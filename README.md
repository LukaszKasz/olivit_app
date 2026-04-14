# Olivit zarządzanie jakością

Aplikacja do zarzadzania zamowieniami uruchamiana lokalnie przez Docker Desktop.

## Wymagania

- Docker Desktop
- Docker Compose v2

## Uruchomienie

```bash
cd /home/lkasztelan/projekty/olivit_app
cp .env.example .env
docker compose up --build -d
```

Projekt Compose ma jawna nazwe `olivi_app`, wiec tak bedzie widoczny w Docker Desktop.

## Dostep

- Frontend: http://localhost:3300
- Backend API: http://localhost:8001
- Swagger: http://localhost:8001/docs
- PostgreSQL: localhost:5432

## Zatrzymanie

```bash
docker compose down
```

## Pelny reset

```bash
docker compose down -v --rmi local
```
