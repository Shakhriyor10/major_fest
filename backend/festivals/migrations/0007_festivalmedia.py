from django.db import migrations, models
import django.db.models.deletion
import festivals.models


class Migration(migrations.Migration):

    dependencies = [
        ("festivals", "0006_appsettings"),
    ]

    operations = [
        migrations.CreateModel(
            name="FestivalMedia",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("media_type", models.CharField(choices=[("image", "Фото"), ("video", "Видео")], default="image", max_length=10, verbose_name="Тип")),
                ("file", models.FileField(upload_to="festival_media/", validators=[festivals.models.validate_festival_media_size], verbose_name="Файл")),
                ("title", models.CharField(blank=True, max_length=160, verbose_name="Заголовок")),
                ("description", models.TextField(blank=True, verbose_name="Описание")),
                ("order", models.PositiveIntegerField(default=0, verbose_name="Порядок")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("festival", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="media_items", to="festivals.festival", verbose_name="Фестиваль")),
            ],
            options={
                "verbose_name": "Медиа фестиваля",
                "verbose_name_plural": "Медиа фестиваля",
                "ordering": ["order", "created_at"],
            },
        ),
    ]
