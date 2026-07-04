from django.contrib.auth import authenticate, get_user_model
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AppSettings, Festival, FestivalApplication, FestivalComment, ParticipantCar, ParticipantProfile
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
admin_signer = TimestampSigner(salt="major-fest-admin")


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
            FestivalApplication.objects.select_related("festival", "participant")
            .prefetch_related("cars__photos", "participant__cars__photos", "photos")
            .order_by("-created_at")
        )
        search = request.query_params.get("search", "").strip()
        status_filter = request.query_params.get("status", "").strip()
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
        serializer = AdminFestivalApplicationSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)


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
        return Response(ParticipantProfileSerializer(profile).data, status=status.HTTP_201_CREATED)


class AuthLoginView(APIView):
    def post(self, request):
        serializer = AuthLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(ParticipantProfileSerializer(serializer.validated_data["profile"]).data)
