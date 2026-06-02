from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("festivals", "0002_participantcar_participantprofile_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="participantprofile",
            name="password_hash",
            field=models.CharField(blank=True, max_length=128, verbose_name="Пароль"),
        ),
    ]
