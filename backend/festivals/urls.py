from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import (
    AdminApplicationDetailView,
    AdminApplicationCreateView,
    AdminApplicationListView,
    AdminLoginView,
    AdminProfileListView,
    AdminProfilePasswordView,
    AdminSummaryView,
    AdminTicketVerifyView,
    AppSettingsView,
    AuthLoginView,
    AuthRegisterView,
    FestivalApplicationViewSet,
    FestivalCommentViewSet,
    FestivalViewSet,
    ParticipantCarViewSet,
    ParticipantProfileSeenView,
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
    path("admin/summary/", AdminSummaryView.as_view(), name="admin-summary"),
    path("admin/profiles/", AdminProfileListView.as_view(), name="admin-profiles"),
    path("admin/applications/create/", AdminApplicationCreateView.as_view(), name="admin-application-create"),
    path("admin/applications/", AdminApplicationListView.as_view(), name="admin-applications"),
    path("admin/applications/<int:pk>/", AdminApplicationDetailView.as_view(), name="admin-application-detail"),
    path("admin/tickets/<int:pk>/verify/", AdminTicketVerifyView.as_view(), name="admin-ticket-verify"),
    path("admin/profiles/<int:pk>/password/", AdminProfilePasswordView.as_view(), name="admin-profile-password"),
    path("profiles/<int:pk>/seen/", ParticipantProfileSeenView.as_view(), name="profile-seen"),
]

urlpatterns += router.urls
