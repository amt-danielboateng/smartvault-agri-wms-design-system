import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("intake", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="WarehouseReceipt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("previous_hash", models.CharField(blank=True, max_length=64)),
                ("block_hash", models.CharField(editable=False, max_length=64)),
                ("issued_at", models.DateTimeField(auto_now_add=True)),
                (
                    "lien_status",
                    models.CharField(
                        choices=[
                            ("ISSUED",   "Issued"),
                            ("PLEDGED",  "Pledged"),
                            ("RELEASED", "Released"),
                            ("VOID",     "Void"),
                        ],
                        db_index=True,
                        default="ISSUED",
                        max_length=16,
                    ),
                ),
                ("lien_holder",  models.CharField(blank=True, max_length=200)),
                ("lien_officer", models.CharField(blank=True, max_length=200)),
                ("lien_date",    models.DateField(blank=True, null=True)),
                (
                    "transaction",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="receipt",
                        to="intake.intaketransaction",
                    ),
                ),
            ],
            options={"ordering": ["-issued_at"]},
        ),
    ]
