from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("festivals", "0005_optional_festival_numbers"),
    ]

    operations = [
        migrations.CreateModel(
            name="AppSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(default="Major Fest", max_length=120, verbose_name="Название приложения")),
                ("logo", models.ImageField(blank=True, upload_to="app_settings/", verbose_name="Логотип")),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Настройки приложения",
                "verbose_name_plural": "Настройки приложения",
            },
        ),
    ]
