import django.contrib.gis.db.models.fields
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="CommodityType",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100, unique=True)),
                ("code", models.CharField(max_length=20, unique=True)),
                ("max_moisture_grade1", models.DecimalField(decimal_places=2, default=13.0, max_digits=5)),
                ("max_moisture_grade2", models.DecimalField(decimal_places=2, default=14.0, max_digits=5)),
                ("max_foreign_matter_pct", models.DecimalField(decimal_places=2, default=2.0, max_digits=5)),
                ("max_broken_grains_pct", models.DecimalField(decimal_places=2, default=4.0, max_digits=5)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Warehouse",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("location", django.contrib.gis.db.models.fields.PointField(srid=4326)),
                ("region", models.CharField(max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name="IntakeTransaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("farmer_id", models.CharField(db_index=True, max_length=64)),
                ("commodity", models.CharField(max_length=100)),
                ("weight_kg", models.DecimalField(decimal_places=2, max_digits=10)),
                ("moisture_percent", models.DecimalField(decimal_places=2, max_digits=5)),
                ("timestamp", models.DateTimeField(auto_now_add=True)),
                ("receipt_hash", models.CharField(blank=True, editable=False, max_length=64)),
                (
                    "warehouse",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="transactions",
                        to="intake.warehouse",
                    ),
                ),
            ],
            options={"ordering": ["-timestamp"]},
        ),
    ]
