from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("festivals", "0003_participantprofile_password_hash"),
    ]

    operations = [
        migrations.CreateModel(
            name="ParticipantCarPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="profile_cars/gallery/", verbose_name="Фото")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "car",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="photos",
                        to="festivals.participantcar",
                        verbose_name="Автомобиль",
                    ),
                ),
            ],
            options={
                "verbose_name": "Фото автомобиля",
                "verbose_name_plural": "Фото автомобилей",
                "ordering": ["created_at"],
            },
        ),
    ]
