from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("festivals", "0008_festivalcoverslide"),
    ]

    operations = [
        migrations.AddField(
            model_name="participantprofile",
            name="photo",
            field=models.ImageField(blank=True, upload_to="profile_photos/", verbose_name="Фото профиля"),
        ),
        migrations.CreateModel(
            name="FestivalWinner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("place", models.PositiveIntegerField(verbose_name="Место")),
                ("title", models.CharField(max_length=160, verbose_name="Заголовок")),
                ("participant_name", models.CharField(blank=True, max_length=160, verbose_name="Имя победителя")),
                ("car_name", models.CharField(blank=True, max_length=160, verbose_name="Автомобиль")),
                ("description", models.TextField(blank=True, verbose_name="Описание")),
                ("image", models.ImageField(blank=True, upload_to="festival_winners/", verbose_name="Фото")),
                ("is_published", models.BooleanField(default=False, verbose_name="Опубликовано")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("festival", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="winners", to="festivals.festival", verbose_name="Фестиваль")),
            ],
            options={
                "verbose_name": "Победитель фестиваля",
                "verbose_name_plural": "Победители фестиваля",
                "ordering": ["place", "created_at"],
            },
        ),
        migrations.CreateModel(
            name="FestivalComment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField(verbose_name="Комментарий")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("festival", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comments", to="festivals.festival", verbose_name="Фестиваль")),
                ("participant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="festival_comments", to="festivals.participantprofile", verbose_name="Участник")),
            ],
            options={
                "verbose_name": "Комментарий фестиваля",
                "verbose_name_plural": "Комментарии фестиваля",
                "ordering": ["-created_at"],
            },
        ),
    ]
