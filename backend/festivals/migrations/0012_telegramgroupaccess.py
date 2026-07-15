from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("festivals", "0011_participantcar_purpose")]
    operations = [
        migrations.CreateModel(
            name="TelegramGroupAccess",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("telegram_user_id", models.BigIntegerField(db_index=True)),
                ("verified_phone", models.CharField(max_length=32)),
                ("invite_link", models.URLField(blank=True, max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("application", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="telegram_group_access", to="festivals.festivalapplication")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
