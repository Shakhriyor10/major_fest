from django.db.models import Count
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AppSettings, Festival, FestivalApplication, FestivalComment, ParticipantCar, ParticipantProfile
from .serializers import (
    AppSettingsSerializer,
    FestivalApplicationSerializer,
    FestivalSerializer,
    AuthLoginSerializer,
    AuthRegisterSerializer,
    FestivalCommentSerializer,
    ParticipantCarSerializer,
    ParticipantProfileSerializer,
)


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
