from rest_framework import serializers

from .models import (
    AppSettings,
    ApplicationPhoto,
    Festival,
    FestivalApplication,
    FestivalCoverSlide,
    FestivalMedia,
    ParticipantCar,
    ParticipantCarPhoto,
    ParticipantProfile,
)


class AppSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppSettings
        fields = ["id", "title", "logo", "updated_at"]


class FestivalMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = FestivalMedia
        fields = ["id", "media_type", "file", "title", "description", "order", "created_at"]


class FestivalCoverSlideSerializer(serializers.ModelSerializer):
    class Meta:
        model = FestivalCoverSlide
        fields = ["id", "image", "title", "order", "created_at"]


class FestivalSerializer(serializers.ModelSerializer):
    applications_count = serializers.IntegerField(read_only=True)
    cover_slides = FestivalCoverSlideSerializer(many=True, read_only=True)
    media_items = FestivalMediaSerializer(many=True, read_only=True)

    class Meta:
        model = Festival
        fields = [
            "id",
            "title",
            "description",
            "city",
            "address",
            "start_date",
            "end_date",
            "prize_fund",
            "prize_places",
            "car_slots",
            "status",
            "cover_image",
            "cover_slides",
            "media_items",
            "applications_count",
        ]


class ApplicationPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationPhoto
        fields = ["id", "image", "caption", "created_at"]


class ParticipantCarPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParticipantCarPhoto
        fields = ["id", "image", "created_at"]


class ParticipantCarSerializer(serializers.ModelSerializer):
    photos = ParticipantCarPhotoSerializer(many=True, read_only=True)
    uploaded_photos = serializers.ListField(
        child=serializers.ImageField(max_length=None, allow_empty_file=False),
        write_only=True,
        required=False,
        allow_empty=True,
        max_length=5,
    )

    class Meta:
        model = ParticipantCar
        fields = [
            "id",
            "owner",
            "make",
            "model",
            "year",
            "engine",
            "condition",
            "tuning_details",
            "main_photo",
            "photos",
            "uploaded_photos",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate_uploaded_photos(self, photos):
        if len(photos) > 5:
            raise serializers.ValidationError("Можно добавить максимум 5 фото.")
        for photo in photos:
            if photo.size > 50 * 1024 * 1024:
                raise serializers.ValidationError("Размер одного фото не должен превышать 50 МБ.")
        return photos

    def create(self, validated_data):
        uploaded_photos = validated_data.pop("uploaded_photos", [])
        car = ParticipantCar.objects.create(**validated_data)
        for index, photo in enumerate(uploaded_photos):
            ParticipantCarPhoto.objects.create(car=car, image=photo)
            if index == 0 and not car.main_photo:
                car.main_photo = photo
                car.save(update_fields=["main_photo"])
        return car

    def update(self, instance, validated_data):
        uploaded_photos = validated_data.pop("uploaded_photos", [])
        instance.applications.all().delete()
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        for index, photo in enumerate(uploaded_photos):
            ParticipantCarPhoto.objects.create(car=instance, image=photo)
            if index == 0 and not instance.main_photo:
                instance.main_photo = photo
                instance.save(update_fields=["main_photo"])
        return instance


class ParticipantProfileSerializer(serializers.ModelSerializer):
    cars = ParticipantCarSerializer(many=True, read_only=True)

    class Meta:
        model = ParticipantProfile
        fields = ["id", "full_name", "phone", "telegram", "city", "cars", "created_at"]
        read_only_fields = ["created_at"]

    def create(self, validated_data):
        phone = validated_data["phone"]
        profile, _created = ParticipantProfile.objects.update_or_create(
            phone=phone,
            defaults=validated_data,
        )
        return profile


class AuthRegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=160)
    phone = serializers.RegexField(regex=r"^\+998\d{9}$")
    password = serializers.CharField(min_length=6, write_only=True)
    password_confirm = serializers.CharField(min_length=6, write_only=True)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Пароли не совпадают."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data.pop("password_confirm")
        if ParticipantProfile.objects.filter(phone=validated_data["phone"]).exists():
            raise serializers.ValidationError({"phone": "Пользователь с этим телефоном уже существует."})
        profile = ParticipantProfile(**validated_data)
        profile.set_password(password)
        profile.save()
        return profile


class AuthLoginSerializer(serializers.Serializer):
    phone = serializers.RegexField(regex=r"^\+998\d{9}$")
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            profile = ParticipantProfile.objects.get(phone=attrs["phone"])
        except ParticipantProfile.DoesNotExist as exc:
            raise serializers.ValidationError({"phone": "Пользователь не найден."}) from exc

        if not profile.password_hash or not profile.check_password(attrs["password"]):
            raise serializers.ValidationError({"password": "Неверный пароль."})

        attrs["profile"] = profile
        return attrs


class FestivalApplicationSerializer(serializers.ModelSerializer):
    photos = ApplicationPhotoSerializer(many=True, read_only=True)
    cars_detail = ParticipantCarSerializer(source="cars", many=True, read_only=True)
    uploaded_photos = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = FestivalApplication
        fields = [
            "id",
            "festival",
            "participant",
            "cars",
            "cars_detail",
            "participant_name",
            "phone",
            "telegram",
            "city",
            "car_make",
            "car_model",
            "car_year",
            "engine",
            "condition",
            "tuning_details",
            "status",
            "moderator_note",
            "photos",
            "uploaded_photos",
            "created_at",
        ]
        read_only_fields = ["status", "moderator_note", "created_at"]

    def validate(self, attrs):
        festival = attrs.get("festival") or getattr(self.instance, "festival", None)
        cars = attrs.get("cars", [])
        if not festival or not cars:
            return attrs

        active_application = FestivalApplication.objects.filter(
            festival=festival,
            cars__in=cars,
        ).distinct().first()
        if active_application:
            used_cars = active_application.cars.filter(id__in=[car.id for car in cars])
            used_names = ", ".join(f"{car.make} {car.model}" for car in used_cars)
            raise serializers.ValidationError({
                "cars": (
                    f"Вы уже участвуете в этом фестивале с машиной: {used_names}. "
                    "Пожалуйста, ждите ответа или выберите другую машину."
                )
            })

        return attrs

    def create(self, validated_data):
        uploaded_photos = validated_data.pop("uploaded_photos", [])
        cars = validated_data.pop("cars", [])
        application = FestivalApplication.objects.create(**validated_data)
        if cars:
            application.cars.set(cars)
        for photo in uploaded_photos:
            ApplicationPhoto.objects.create(application=application, image=photo)
        return application
