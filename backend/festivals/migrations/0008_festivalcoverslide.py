from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("festivals", "0007_festivalmedia"),
    ]

    operations = [
        migrations.CreateModel(
            name="FestivalCoverSlide",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="festival_cover_slides/", verbose_name="Фото карусели")),
                ("title", models.CharField(blank=True, max_length=120, verbose_name="Заголовок")),
                ("order", models.PositiveIntegerField(default=0, verbose_name="Порядок")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("festival", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="cover_slides", to="festivals.festival", verbose_name="Фестиваль")),
            ],
            options={
                "verbose_name": "Фото карусели",
                "verbose_name_plural": "Фото карусели",
                "ordering": ["order", "created_at"],
            },
        ),
    ]
