from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("festivals", "0010_participantprofile_last_seen_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="participantcar",
            name="purpose",
            field=models.CharField(
                blank=True,
                choices=[
                    ("avtozvuk", "Автозвук"),
                    ("drift", "Дрифт"),
                    ("retro", "Ретро"),
                    ("milliy", "Миллий"),
                    ("tuning", "Тюнинг"),
                ],
                default="",
                max_length=20,
                verbose_name="Для чего машина",
            ),
        ),
    ]
