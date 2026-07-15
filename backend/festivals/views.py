from django.contrib.auth import authenticate, get_user_model
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AppSettings, ApplicationPhoto, Festival, FestivalApplication, FestivalComment, ParticipantCar, ParticipantCarPhoto, ParticipantProfile
from .serializers import (
    AdminFestivalApplicationSerializer,
    AppSettingsSerializer,
    FestivalApplicationSerializer,
    FestivalSerializer,
    AuthLoginSerializer,
    AuthRegisterSerializer,
    FestivalCommentSerializer,
    ParticipantCarSerializer,
    ParticipantProfileSerializer,
)


ADMIN_TOKEN_MAX_AGE = 60 * 60 * 12
ONLINE_WINDOW_MINUTES = 5
admin_signer = TimestampSigner(salt="major-fest-admin")

CAR_PURPOSE_LABELS = {
    "avtozvuk": "Автозвук",
    "drift": "Дрифт",
    "retro": "Ретро",
    "milliy": "Миллий",
    "tuning": "Тюнинг",
}


def ticket_application_id(application):
    return f"SF-{str(application.get('id') or 0).zfill(5)}"


def ticket_hash(value):
    hash_value = 2166136261
    for char in str(value):
        hash_value ^= ord(char)
        hash_value = (hash_value * 16777619) & 0xFFFFFFFF
    return hash_value


def ticket_secure_code(application):
    cars = application.get("cars_detail") or []
    cars_text = ", ".join(
        " - ".join(filter(None, [
            f"{car.get('make') or ''} {car.get('model') or ''}".strip(),
            CAR_PURPOSE_LABELS.get(car.get("purpose") or ""),
        ]))
        for car in cars
    )
    if not cars_text:
        legacy_car = f"{application.get('car_make') or ''} {application.get('car_model') or ''}".strip()
        legacy_purpose = CAR_PURPOSE_LABELS.get(application.get("purpose") or "")
        cars_text = " - ".join(filter(None, [legacy_car, legacy_purpose])) or "Автомобиль не указан"
    seed = "|".join([
        ticket_application_id(application),
        str(application.get("participant") or ""),
        str(application.get("festival") or ""),
        str(application.get("created_at") or ""),
        str(application.get("phone") or ""),
        cars_text,
    ])
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    number = ticket_hash(seed)
    encoded = ""
    while number:
        number, remainder = divmod(number, 36)
        encoded = chars[remainder] + encoded
    encoded = encoded.rjust(7, "0")
    return f"{ticket_application_id(application)}-{encoded[:3]}-{encoded[3:7]}"


def get_admin_user(request):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header.removeprefix("Bearer ").strip()
    try:
        value = admin_signer.unsign(token, max_age=ADMIN_TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
    if not value.startswith("admin:"):
        return None
    user_id = value.split(":", 1)[1]
    try:
        user = get_user_model().objects.get(id=user_id, is_active=True)
    except get_user_model().DoesNotExist:
        return None
    if not user.is_staff:
        return None
    return user


def require_admin(request):
    user = get_admin_user(request)
    if user is None:
        return None, Response({"detail": "Нужен вход администратора."}, status=status.HTTP_401_UNAUTHORIZED)
    return user, None


class AdminLoginView(APIView):
    def post(self, request):
        username = request.data.get("username", "")
        password = request.data.get("password", "")
        user = authenticate(request, username=username, password=password)
        if user is None or not user.is_active or not user.is_staff:
            return Response({"detail": "Неверный логин или пароль администратора."}, status=status.HTTP_400_BAD_REQUEST)
        token = admin_signer.sign(f"admin:{user.id}")
        return Response({
            "token": token,
            "username": user.get_username(),
            "expires_in": ADMIN_TOKEN_MAX_AGE,
        })


class AdminApplicationListView(APIView):
    def get(self, request):
        _user, error = require_admin(request)
        if error:
            return error
        queryset = (
            FestivalApplication.objects.select_related("festival", "participant", "created_by")
            .prefetch_related("cars__photos", "participant__cars__photos", "photos")
            .order_by("-created_at")
        )
        search = request.query_params.get("search", "").strip()
        status_filter = request.query_params.get("status", "").strip()
        purpose_filter = request.query_params.get("purpose", "").strip()
        if search:
            queryset = queryset.filter(
                Q(participant_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(telegram__icontains=search)
                | Q(city__icontains=search)
                | Q(car_make__icontains=search)
                | Q(car_model__icontains=search)
                | Q(participant__full_name__icontains=search)
            )
        if status_filter:
            if status_filter == "pending":
                queryset = queryset.filter(status__in=[FestivalApplication.Status.NEW, FestivalApplication.Status.REVIEWING])
            elif status_filter in [FestivalApplication.Status.APPROVED, FestivalApplication.Status.REJECTED]:
                queryset = queryset.filter(status=status_filter)
        if purpose_filter in ParticipantCar.Purpose.values:
            queryset = queryset.filter(Q(purpose=purpose_filter) | Q(cars__purpose=purpose_filter)).distinct()
        serializer = AdminFestivalApplicationSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)


class AdminApplicationCreateView(APIView):
    def post(self, request):
        admin_user, error = require_admin(request)
        if error:
            return error

        data = request.data
        required_fields = [
            "festival",
            "full_name",
            "car_make",
            "car_model",
            "car_year",
            "engine",
            "purpose",
            "condition",
        ]
        missing = [field for field in required_fields if not str(data.get(field, "")).strip()]
        if missing:
            return Response({field: "РћР±СЏР·Р°С‚РµР»СЊРЅРѕРµ РїРѕР»Рµ." for field in missing}, status=status.HTTP_400_BAD_REQUEST)

        purpose = str(data.get("purpose", "")).strip()
        if purpose not in ParticipantCar.Purpose.values:
            return Response({"purpose": "Р’С‹Р±РµСЂРёС‚Рµ Р·РЅР°С‡РµРЅРёРµ РёР· СЃРїРёСЃРєР°."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            car_year = int(data.get("car_year"))
        except (TypeError, ValueError):
            return Response({"car_year": "РЈРєР°Р¶РёС‚Рµ РіРѕРґ С‡РёСЃР»РѕРј."}, status=status.HTTP_400_BAD_REQUEST)
        if car_year < 1900 or car_year > 2026:
            return Response({"car_year": "Р“РѕРґ Р°РІС‚РѕРјРѕР±РёР»СЏ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РѕС‚ 1900 РґРѕ 2026."}, status=status.HTTP_400_BAD_REQUEST)

        festival = get_object_or_404(Festival, pk=data.get("festival"))
        phone_digits = "".join(ch for ch in str(data.get("phone", "")) if ch.isdigit())
        if phone_digits and len(phone_digits) < 7:
            return Response({"phone": "Укажите номер телефона полностью."}, status=status.HTTP_400_BAD_REQUEST)
        phone = f"+{phone_digits}" if phone_digits else ""
        raw_password = phone_digits
        full_name = str(data.get("full_name", "")).strip()
        existing_phone_digits = {
            "".join(ch for ch in existing_phone if ch.isdigit())
            for existing_phone in ParticipantProfile.objects.values_list("phone", flat=True)
        }
        if phone_digits and phone_digits in existing_phone_digits:
            return Response({
                "phone": "С этим номером уже есть профиль. Нельзя создать новую заявку через эту форму."
            }, status=status.HTTP_400_BAD_REQUEST)
        photos = request.FILES.getlist("photos")
        if len(photos) > 5:
            return Response({"photos": "Можно добавить максимум 5 фото."}, status=status.HTTP_400_BAD_REQUEST)
        for photo in photos:
            if photo.size > 50 * 1024 * 1024:
                return Response({"photos": "Размер одного фото не должен превышать 50 МБ."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            profile = None
            car = None
            if phone:
                profile = ParticipantProfile.objects.create(
                    phone=phone,
                    full_name=full_name,
                    telegram=str(data.get("telegram", "")).strip(),
                    city=str(data.get("city", "")).strip(),
                )
                profile.set_password(raw_password)
                profile.save(update_fields=["password_hash"])
                car = ParticipantCar.objects.create(
                    owner=profile,
                    make=str(data.get("car_make", "")).strip(),
                    model=str(data.get("car_model", "")).strip(),
                    year=car_year,
                    engine=str(data.get("engine", "")).strip(),
                    purpose=purpose,
                    condition=str(data.get("condition", "")).strip(),
                    tuning_details=str(data.get("tuning_details", "")).strip(),
                )
            application = FestivalApplication.objects.create(
                festival=festival,
                participant=profile,
                created_by=admin_user,
                participant_name=full_name,
                phone=phone,
                telegram=str(data.get("telegram", "")).strip(),
                city=str(data.get("city", "")).strip(),
                car_make=str(data.get("car_make", "")).strip(),
                car_model=str(data.get("car_model", "")).strip(),
                car_year=car_year,
                engine=str(data.get("engine", "")).strip(),
                purpose=purpose,
                condition=str(data.get("condition", "")).strip(),
                tuning_details=str(data.get("tuning_details", "")).strip(),
                status=FestivalApplication.Status.APPROVED,
                moderator_note="Заявка добавлена администратором.",
            )
            if car:
                application.cars.set([car])
            for index, photo in enumerate(photos):
                if car:
                    car_photo = ParticipantCarPhoto.objects.create(car=car, image=photo)
                    ApplicationPhoto.objects.create(application=application, image=car_photo.image)
                    if index == 0 and not car.main_photo:
                        car.main_photo = car_photo.image
                        car.save(update_fields=["main_photo"])
                else:
                    ApplicationPhoto.objects.create(application=application, image=photo)

        application = (
            FestivalApplication.objects.select_related("festival", "participant", "created_by")
            .prefetch_related("cars__photos", "participant__cars__photos", "photos")
            .get(pk=application.pk)
        )
        response_data = AdminFestivalApplicationSerializer(application, context={"request": request}).data
        response_data["admin_credentials"] = ({"login": phone, "password": raw_password} if phone else None)
        return Response(response_data, status=status.HTTP_201_CREATED)


class AdminSummaryView(APIView):
    def get(self, request):
        _user, error = require_admin(request)
        if error:
            return error
        online_since = timezone.now() - timedelta(minutes=ONLINE_WINDOW_MINUTES)
        return Response({
            "profiles_total": ParticipantProfile.objects.count(),
            "profiles_online": ParticipantProfile.objects.filter(last_seen_at__gte=online_since).count(),
            "online_window_minutes": ONLINE_WINDOW_MINUTES,
        })


class AdminProfileListView(APIView):
    def get(self, request):
        _user, error = require_admin(request)
        if error:
            return error
        queryset = (
            ParticipantProfile.objects.prefetch_related("cars__photos")
            .annotate(applications_count=Count("applications", distinct=True))
            .order_by("-created_at")
        )
        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(telegram__icontains=search)
                | Q(city__icontains=search)
                | Q(cars__make__icontains=search)
                | Q(cars__model__icontains=search)
            ).distinct()
        profiles = list(queryset)
        serializer = ParticipantProfileSerializer(profiles, many=True, context={"request": request})
        data = serializer.data
        applications_by_profile = {profile.id: profile.applications_count for profile in profiles}
        for item in data:
            applications_count = applications_by_profile.get(item["id"], 0)
            item["applications_count"] = applications_count
            item["has_applications"] = applications_count > 0
        return Response(data)


class AdminApplicationDetailView(APIView):
    def get(self, request, pk):
        _user, error = require_admin(request)
        if error:
            return error
        application = get_object_or_404(
            FestivalApplication.objects.select_related("festival", "participant")
            .prefetch_related("cars__photos", "participant__cars__photos", "photos"),
            pk=pk,
        )
        return Response(AdminFestivalApplicationSerializer(application, context={"request": request}).data)

    def patch(self, request, pk):
        _user, error = require_admin(request)
        if error:
            return error
        application = get_object_or_404(FestivalApplication, pk=pk)
        new_status = request.data.get("status")
        moderator_note = request.data.get("moderator_note")
        allowed_statuses = {choice[0] for choice in FestivalApplication.Status.choices}
        if new_status and new_status not in allowed_statuses:
            return Response({"status": "Неверный статус заявки."}, status=status.HTTP_400_BAD_REQUEST)
        if new_status:
            application.status = new_status
        if moderator_note is not None:
            application.moderator_note = moderator_note
        application.save(update_fields=["status", "moderator_note", "updated_at"])
        application = (
            FestivalApplication.objects.select_related("festival", "participant")
            .prefetch_related("cars__photos", "participant__cars__photos", "photos")
            .get(pk=application.pk)
        )
        return Response(AdminFestivalApplicationSerializer(application, context={"request": request}).data)


class AdminTicketVerifyView(APIView):
    def get(self, request, pk):
        application = get_object_or_404(
            FestivalApplication.objects.select_related("festival", "participant")
            .prefetch_related("cars__photos", "participant__cars__photos", "photos"),
            pk=pk,
        )
        data = AdminFestivalApplicationSerializer(application, context={"request": request}).data
        secure_code = ticket_secure_code(data)
        provided_code = request.query_params.get("code", "")
        if provided_code != secure_code:
            return Response({
                "valid": False,
                "detail": "Контрольный код билета не совпадает.",
            }, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "valid": application.status == FestivalApplication.Status.APPROVED,
            "secure_code": secure_code,
            "application": data,
        })


class AdminProfilePasswordView(APIView):
    def post(self, request, pk):
        _user, error = require_admin(request)
        if error:
            return error
        password = request.data.get("password", "")
        if len(password) < 6:
            return Response({"password": "Пароль должен быть минимум 6 символов."}, status=status.HTTP_400_BAD_REQUEST)
        profile = get_object_or_404(ParticipantProfile, pk=pk)
        profile.set_password(password)
        profile.save(update_fields=["password_hash"])
        return Response({"detail": "Пароль пользователя изменен."})


class AppSettingsView(APIView):
    def get(self, request):
        settings = AppSettings.objects.order_by("-updated_at").first()
        if settings is None:
            settings = AppSettings.objects.create()
        return Response(AppSettingsSerializer(settings, context={"request": request}).data)


class FestivalViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FestivalSerializer

    def get_queryset(self):
        return (
            Festival.objects.filter(status__in=[Festival.Status.OPEN, Festival.Status.CLOSED, Festival.Status.FINISHED])
            .prefetch_related("cover_slides", "media_items", "winners", "comments__participant")
            .annotate(applications_count=Count("applications"))
            .order_by("start_date")
        )


class FestivalApplicationViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = FestivalApplicationSerializer

    def get_queryset(self):
        queryset = FestivalApplication.objects.select_related("festival", "participant").prefetch_related("cars")
        participant_id = self.request.query_params.get("participant")
        phone = self.request.query_params.get("phone")
        if participant_id:
            queryset = queryset.filter(participant_id=participant_id)
        if phone:
            queryset = queryset.filter(phone=phone)
        return queryset


class FestivalCommentViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = FestivalCommentSerializer

    def get_queryset(self):
        queryset = FestivalComment.objects.select_related("festival", "participant")
        festival_id = self.request.query_params.get("festival")
        participant_id = self.request.query_params.get("participant")
        if festival_id:
            queryset = queryset.filter(festival_id=festival_id)
        if participant_id:
            queryset = queryset.filter(participant_id=participant_id)
        return queryset

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        participant_id = request.query_params.get("participant")
        if not participant_id or str(instance.participant_id) != str(participant_id):
            return Response({"detail": "Можно удалить только свой комментарий."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class ParticipantProfileViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = ParticipantProfile.objects.prefetch_related("cars__photos")
    serializer_class = ParticipantProfileSerializer


class ParticipantCarViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ParticipantCarSerializer

    def get_queryset(self):
        queryset = ParticipantCar.objects.select_related("owner").prefetch_related("photos")
        owner_id = self.request.query_params.get("owner")
        if owner_id:
            queryset = queryset.filter(owner_id=owner_id)
        return queryset

    def perform_destroy(self, instance):
        instance.applications.all().delete()
        instance.delete()


class AuthRegisterView(APIView):
    def post(self, request):
        serializer = AuthRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        profile.last_seen_at = timezone.now()
        profile.save(update_fields=["last_seen_at"])
        return Response(ParticipantProfileSerializer(profile).data, status=status.HTTP_201_CREATED)


class AuthLoginView(APIView):
    def post(self, request):
        serializer = AuthLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.validated_data["profile"]
        profile.last_seen_at = timezone.now()
        profile.save(update_fields=["last_seen_at"])
        return Response(ParticipantProfileSerializer(profile).data)


class ParticipantProfileSeenView(APIView):
    def post(self, request, pk):
        profile = get_object_or_404(ParticipantProfile, pk=pk)
        profile.last_seen_at = timezone.now()
        profile.save(update_fields=["last_seen_at"])
        return Response(ParticipantProfileSerializer(profile).data)
