from django.core.exceptions import ValidationError
from django.contrib.auth.hashers import check_password, make_password
from django.db import models


def validate_festival_media_size(file):
    if file.size > 200 * 1024 * 1024:
        raise ValidationError("Размер файла не должен превышать 200 МБ.")


class AppSettings(models.Model):
    title = models.CharField("Название приложения", max_length=120, default="Major Fest")
    logo = models.ImageField("Логотип", upload_to="app_settings/", blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Настройки приложения"
        verbose_name_plural = "Настройки приложения"

    def __str__(self):
        return self.title


class Festival(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        OPEN = "open", "Прием заявок"
        CLOSED = "closed", "Прием закрыт"
        FINISHED = "finished", "Завершен"

    title = models.CharField("Название", max_length=180)
    description = models.TextField("Описание", blank=True)
    city = models.CharField("Город", max_length=120)
    address = models.CharField("Адрес", max_length=255, blank=True)
    start_date = models.DateTimeField("Дата начала")
    end_date = models.DateTimeField("Дата окончания", null=True, blank=True)
    prize_fund = models.DecimalField("Призовой фонд", max_digits=12, decimal_places=2, null=True, blank=True)
    prize_places = models.PositiveIntegerField("Количество призовых мест", null=True, blank=True)
    car_slots = models.PositiveIntegerField("Количество машин участников", null=True, blank=True)
    status = models.CharField("Статус", max_length=20, choices=Status.choices, default=Status.DRAFT)
    cover_image = models.ImageField("Обложка", upload_to="festival_covers/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]
        verbose_name = "Фестиваль"
        verbose_name_plural = "Фестивали"

    def __str__(self):
        return self.title


class FestivalCoverSlide(models.Model):
    festival = models.ForeignKey(
        Festival,
        related_name="cover_slides",
        on_delete=models.CASCADE,
        verbose_name="Фестиваль",
    )
    image = models.ImageField("Фото карусели", upload_to="festival_cover_slides/")
    title = models.CharField("Заголовок", max_length=120, blank=True)
    order = models.PositiveIntegerField("Порядок", default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]
        verbose_name = "Фото карусели"
        verbose_name_plural = "Фото карусели"

    def __str__(self):
        return self.title or f"Фото карусели #{self.id}"


class FestivalMedia(models.Model):
    class MediaType(models.TextChoices):
        IMAGE = "image", "Фото"
        VIDEO = "video", "Видео"

    festival = models.ForeignKey(
        Festival,
        related_name="media_items",
        on_delete=models.CASCADE,
        verbose_name="Фестиваль",
    )
    media_type = models.CharField("Тип", max_length=10, choices=MediaType.choices, default=MediaType.IMAGE)
    file = models.FileField("Файл", upload_to="festival_media/", validators=[validate_festival_media_size])
    title = models.CharField("Заголовок", max_length=160, blank=True)
    description = models.TextField("Описание", blank=True)
    order = models.PositiveIntegerField("Порядок", default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]
        verbose_name = "Медиа фестиваля"
        verbose_name_plural = "Медиа фестиваля"

    def __str__(self):
        return self.title or f"{self.get_media_type_display()} #{self.id}"


class ParticipantProfile(models.Model):
    full_name = models.CharField("Имя", max_length=160)
    phone = models.CharField("Телефон", max_length=32, unique=True)
    password_hash = models.CharField("Пароль", max_length=128, blank=True)
    telegram = models.CharField("Telegram", max_length=80, blank=True)
    city = models.CharField("Город", max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]
        verbose_name = "Профиль участника"
        verbose_name_plural = "Профили участников"

    def __str__(self):
        return f"{self.full_name} ({self.phone})"

    def set_password(self, raw_password):
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password):
        return check_password(raw_password, self.password_hash)


class ParticipantCar(models.Model):
    owner = models.ForeignKey(
        ParticipantProfile,
        related_name="cars",
        on_delete=models.CASCADE,
        verbose_name="Владелец",
    )
    make = models.CharField("Марка", max_length=120)
    model = models.CharField("Модель", max_length=120)
    year = models.PositiveIntegerField("Год выпуска")
    engine = models.CharField("Мотор", max_length=160)
    condition = models.TextField("Состояние машины")
    tuning_details = models.TextField("Тюнинг и особенности", blank=True)
    main_photo = models.ImageField("Главное фото", upload_to="profile_cars/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Машина участника"
        verbose_name_plural = "Машины участников"

    def __str__(self):
        return f"{self.make} {self.model} {self.year}"


class ParticipantCarPhoto(models.Model):
    car = models.ForeignKey(
        ParticipantCar,
        related_name="photos",
        on_delete=models.CASCADE,
        verbose_name="Автомобиль",
    )
    image = models.ImageField("Фото", upload_to="profile_cars/gallery/")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = "Фото автомобиля"
        verbose_name_plural = "Фото автомобилей"

    def __str__(self):
        return f"Фото {self.car_id}"


class FestivalApplication(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "Новая"
        REVIEWING = "reviewing", "На рассмотрении"
        APPROVED = "approved", "Одобрена"
        REJECTED = "rejected", "Отказ"

    festival = models.ForeignKey(
        Festival,
        related_name="applications",
        on_delete=models.CASCADE,
        verbose_name="Фестиваль",
    )
    participant = models.ForeignKey(
        ParticipantProfile,
        related_name="applications",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name="Участник",
    )
    cars = models.ManyToManyField(
        ParticipantCar,
        related_name="applications",
        blank=True,
        verbose_name="Выбранные машины",
    )
    participant_name = models.CharField("Имя участника", max_length=160)
    phone = models.CharField("Телефон", max_length=32)
    telegram = models.CharField("Telegram", max_length=80, blank=True)
    city = models.CharField("Город участника", max_length=120, blank=True)
    car_make = models.CharField("Марка", max_length=120)
    car_model = models.CharField("Модель", max_length=120)
    car_year = models.PositiveIntegerField("Год выпуска")
    engine = models.CharField("Мотор", max_length=160)
    condition = models.TextField("Состояние машины")
    tuning_details = models.TextField("Тюнинг и особенности", blank=True)
    status = models.CharField("Статус", max_length=20, choices=Status.choices, default=Status.NEW)
    moderator_note = models.TextField("Комментарий модератора", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Заявка"
        verbose_name_plural = "Заявки"

    def __str__(self):
        return f"{self.participant_name} - {self.car_make} {self.car_model}"


class ApplicationPhoto(models.Model):
    application = models.ForeignKey(
        FestivalApplication,
        related_name="photos",
        on_delete=models.CASCADE,
        verbose_name="Заявка",
    )
    image = models.ImageField("Фото", upload_to="application_cars/")
    caption = models.CharField("Подпись", max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Фото машины"
        verbose_name_plural = "Фото машин"

    def __str__(self):
        return self.caption or f"Фото заявки #{self.application_id}"
