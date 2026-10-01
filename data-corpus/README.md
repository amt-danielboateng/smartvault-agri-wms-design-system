# SmartVault Agri-WMS — Seed Data Corpus

Pilot deployment fixtures for Ghana's Ashanti, Bono, Ahafo, and Northern agricultural belts.

## Load order

Run from the `backend/` directory inside the Docker container or virtualenv:

```bash
# 1. Apply all migrations (includes new lien_status and CommodityType fields)
python manage.py migrate

# 2. Load commodity types (grading thresholds)
python manage.py loaddata ../data-corpus/commodity_types.json

# 3. Load warehouses (PostGIS points — requires PostGIS extension)
python manage.py loaddata ../data-corpus/warehouses.json

# 4. Load sample intake transactions
#    Note: receipt_hash is computed on save() — blank values are intentional
python manage.py loaddata ../data-corpus/intake_transactions.json

# 5. Create operator superuser for pilot
python manage.py createsuperuser
```

## Fixtures

| File | Model | Records |
|------|-------|---------|
| `commodity_types.json` | `intake.CommodityType` | 5 commodities with GGDB thresholds |
| `warehouses.json` | `intake.Warehouse` | 6 regional hubs with GPS coordinates |
| `intake_transactions.json` | `intake.IntakeTransaction` | 5 sample consignments |

## Notes

- `WarehouseReceipt` records are auto-issued via post-save signal — no fixture needed.
- `receipt_hash` fields in `intake_transactions.json` are blank; Django computes them on `save()`.
- Warehouse coordinates use SRID 4326 (WGS84) — PostGIS must be enabled before loading.
- `WAREHOUSE_MANAGER_PHONE` must be set in `.env` for spoilage SMS alerts to fire.
