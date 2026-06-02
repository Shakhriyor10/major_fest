from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("festivals", "0004_participantcarphoto"),
    ]

    operations = [
        migrations.AlterField(
            model_name="festival",
            name="car_slots",
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name="Количество машин участников"),
        ),
        migrations.AlterField(
            model_name="festival",
            name="prize_fund",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True, verbose_name="Призовой фонд"),
        ),
        migrations.AlterField(
            model_name="festival",
            name="prize_places",
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name="Количество призовых мест"),
        ),
    ]
