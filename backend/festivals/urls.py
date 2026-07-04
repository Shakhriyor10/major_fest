from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import (
    AdminApplicationDetailView,
    AdminApplicationListView,
    AdminLoginView,
    AdminProfilePasswordView,
    AppSettingsView,
    AuthLoginView,
    AuthRegisterView,
    FestivalApplicationViewSet,
    FestivalCommentViewSet,
    FestivalViewSet,
    ParticipantCarViewSet,
    ParticipantProfileViewSet,
)

router = DefaultRouter()
router.register("festivals", FestivalViewSet, basename="festival")
router.register("applications", FestivalApplicationViewSet, basename="application")
router.register("comments", FestivalCommentViewSet, basename="comment")
router.register("profiles", ParticipantProfileViewSet, basename="profile")
router.register("cars", ParticipantCarViewSet, basename="car")

urlpatterns = [
    path("app-settings/", AppSettingsView.as_view(), name="app-settings"),
    path("auth/register/", AuthRegisterView.as_view(), name="auth-register"),
    path("auth/login/", AuthLoginView.as_view(), name="auth-login"),
    path("admin/login/", AdminLoginView.as_view(), name="admin-login"),
    path("admin/applications/", AdminApplicationListView.as_view(), name="admin-applications"),
    path("admin/applications/<int:pk>/", AdminApplicationDetailView.as_view(), name="admin-application-detail"),
    path("admin/profiles/<int:pk>/password/", AdminProfilePasswordView.as_view(), name="admin-profile-password"),
]

urlpatterns += router.urls
