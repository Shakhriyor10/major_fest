from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import (
    AppSettingsView,
    AuthLoginView,
    AuthRegisterView,
    FestivalApplicationViewSet,
    FestivalViewSet,
    ParticipantCarViewSet,
    ParticipantProfileViewSet,
)

router = DefaultRouter()
router.register("festivals", FestivalViewSet, basename="festival")
router.register("applications", FestivalApplicationViewSet, basename="application")
router.register("profiles", ParticipantProfileViewSet, basename="profile")
router.register("cars", ParticipantCarViewSet, basename="car")

urlpatterns = [
    path("app-settings/", AppSettingsView.as_view(), name="app-settings"),
    path("auth/register/", AuthRegisterView.as_view(), name="auth-register"),
    path("auth/login/", AuthLoginView.as_view(), name="auth-login"),
]

urlpatterns += router.urls
