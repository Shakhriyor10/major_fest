from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("festivals", "0012_telegramgroupaccess"),
    ]

    operations = [
        migrations.AddField(
            model_name="festivalapplication",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="created_festival_applications",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Создано администратором",
            ),
        ),
        migrations.AddField(
            model_name="festivalapplication",
            name="purpose",
            field=models.CharField(blank=True, choices=[("avtozvuk", "Автозвук"), ("drift", "Дрифт"), ("retro", "Ретро"), ("milliy", "Миллий"), ("tuning", "Тюнинг")], default="", max_length=20),
        ),
    ]
