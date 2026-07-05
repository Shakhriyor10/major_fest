from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("festivals", "0009_profile_photo_winners_comments"),
    ]

    operations = [
        migrations.AddField(
            model_name="participantprofile",
            name="last_seen_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="Last seen"),
        ),
    ]
