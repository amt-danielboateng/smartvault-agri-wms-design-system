# SmartVault Agri-WMS

SmartVault Agri-WMS is an offline-first warehouse management platform for agricultural cooperatives, commodity aggregators, and public grain reserves.

It connects warehouse intake operations, commodity grading, electronic warehouse receipts, and silo environmental telemetry in one system. The platform is designed for facilities where connectivity can be intermittent and where reliable stock, quality, and ownership records matter.

## What It Does

- Records incoming consignments, weights, moisture readings, foreign matter, and grades.
- Generates traceable electronic warehouse receipt records.
- Monitors silo temperature and humidity through MQTT-connected sensor nodes.
- Queues frontend intake work locally for offline use and synchronizes when connectivity returns.
- Provides dashboards for intake activity and silo telemetry.
- Supports SMS and USSD integrations for warehouse and farmer workflows.

## Architecture

| Component | Technology | Responsibility |
| --- | --- | --- |
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Workbox | Operator PWA, intake workflow, registry, telemetry views |
| API | Django 5, Django REST Framework | Authentication, warehouse operations, receipts, alerts |
| Database | PostgreSQL 16, PostGIS, TimescaleDB | Relational, spatial, and time-series data |
| Queue and cache | Redis, Celery | Background jobs, synchronization, notifications |
| IoT broker | Eclipse Mosquitto | Secure MQTT telemetry ingestion |
| Edge firmware | ESP32 C++ and MicroPython | Temperature and humidity sensor publishing |

## Run Locally

Requirements:

- Docker Engine with Docker Compose
- OpenSSL

Start from the repository root:

```bash
./scripts/dev-certs/generate.sh
docker compose up --build -d
docker compose ps
```

The certificate script creates free, self-signed development certificates for Nginx and Mosquitto. They are suitable for local testing only. The browser will show a certificate warning when opening the application.

Open the application at:

- `https://localhost` - frontend and API through Nginx
- `http://localhost:3000` - direct frontend access for UI testing
Port `443` is the normal application entry point. Nginx routes `/` to Next.js and `/api/` to Django. The database, Redis, and MQTT services should not be made public.

Stop the stack with:

```bash
docker compose down
```

Named volumes are preserved by that command. To remove local data as well, use `docker compose down -v`.

## Create an Admin Account

Once the database is available, create an application administrator with:

```bash
docker compose exec -it backend python manage.py createsuperuser
```

The same username and password are used on the frontend sign-in page. There is no public signup flow because this is intended to be an internal warehouse operations system.

## Seed Pilot Data

The `data-corpus/` directory contains pilot fixtures for Ghanaian agricultural regions. Load them from a backend container after migrations:

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py loaddata ../data-corpus/commodity_types.json
docker compose exec backend python manage.py loaddata ../data-corpus/warehouses.json
docker compose exec backend python manage.py loaddata ../data-corpus/intake_transactions.json
```

The fixtures include commodity grading thresholds, warehouse locations, and sample intake transactions. See [data-corpus/README.md](data-corpus/README.md) for fixture details.

## MQTT Topics

Telemetry is published to topics in this form:

```text
silo/<silo-id>/telemetry
```

The local Mosquitto TLS listener uses port `8883`. The bridge subscribes to `silo/+/telemetry` and forwards readings to Celery for persistence.

## Repository Layout

```text
apps/                 ESP32 and MicroPython firmware
backend/              Django API and background task configuration
data-corpus/          Pilot fixtures and seed data
frontend/             Next.js operator application
infra/                Nginx and Mosquitto configuration
scripts/dev-certs/    Local certificate bootstrap
services/mqtt_bridge/ MQTT-to-Celery telemetry bridge
tokens/               Design token sources
```

## Development Notes

- Generated certificates and private keys are ignored by Git.
- The local `.env` file contains development-only credentials and must not be used in production.
- Production deployments should use trusted certificates, strong secrets, restricted network exposure, and a managed user provisioning process.
- The current Docker Compose file includes host-gateway routing for this development-container environment; production networking should use private service-to-service networking instead.

## Project Context

SmartVault is designed for agricultural storage networks in Ghana's Ashanti, Bono, Ahafo, and Northern belts. Its goal is to reduce post-harvest losses, make quality decisions auditable, and give farmers and financial partners verifiable visibility into stored commodities.