from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="SiloSensorReading",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("time", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("silo_id", models.CharField(db_index=True, max_length=64)),
                ("temperature_c", models.FloatField()),
                ("humidity_percent", models.FloatField()),
            ],
            options={
                "ordering": ["-time"],
                "abstract": False,
            },
        ),
        # Timescale hypertables cannot retain a primary-key index that omits
        # the partitioning column. Django still uses the id field, but the
        # database constraint must be removed before conversion.
        migrations.RunSQL(
            sql=(
                "ALTER TABLE telemetry_silosensorreading "
                "DROP CONSTRAINT IF EXISTS telemetry_silosensorreading_pkey; "
                "SELECT create_hypertable(" 
                "'telemetry_silosensorreading', 'time', if_not_exists => TRUE);"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
