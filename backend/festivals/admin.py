from django.contrib import admin

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


@admin.register(AppSettings)
class AppSettingsAdmin(admin.ModelAdmin):
    list_display = ("title", "updated_at")


class ApplicationPhotoInline(admin.TabularInline):
    model = ApplicationPhoto
    extra = 0


class FestivalMediaInline(admin.TabularInline):
    model = FestivalMedia
    extra = 1


class FestivalCoverSlideInline(admin.TabularInline):
    model = FestivalCoverSlide
    extra = 1
    max_num = 5


@admin.register(Festival)
class FestivalAdmin(admin.ModelAdmin):
    list_display = ("title", "city", "start_date", "status", "car_slots", "prize_fund")
    list_filter = ("status", "city")
    search_fields = ("title", "city", "address")
    inlines = [FestivalCoverSlideInline, FestivalMediaInline]


@admin.register(FestivalCoverSlide)
class FestivalCoverSlideAdmin(admin.ModelAdmin):
    list_display = ("festival", "title", "order", "created_at")
    list_filter = ("festival",)
    search_fields = ("festival__title", "title")


@admin.register(FestivalMedia)
class FestivalMediaAdmin(admin.ModelAdmin):
    list_display = ("festival", "media_type", "title", "order", "created_at")
    list_filter = ("media_type", "festival")
    search_fields = ("festival__title", "title", "description")


@admin.register(FestivalApplication)
class FestivalApplicationAdmin(admin.ModelAdmin):
    list_display = ("participant_name", "festival", "car_make", "car_model", "status", "created_at")
    list_filter = ("status", "festival", "city")
    search_fields = ("participant_name", "phone", "telegram", "car_make", "car_model")
    filter_horizontal = ("cars",)
    inlines = [ApplicationPhotoInline]


@admin.register(ApplicationPhoto)
class ApplicationPhotoAdmin(admin.ModelAdmin):
    list_display = ("application", "caption", "created_at")


class ParticipantCarInline(admin.TabularInline):
    model = ParticipantCar
    extra = 0


class ParticipantCarPhotoInline(admin.TabularInline):
    model = ParticipantCarPhoto
    extra = 0


@admin.register(ParticipantProfile)
class ParticipantProfileAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone", "telegram", "city", "created_at")
    search_fields = ("full_name", "phone", "telegram", "city")
    inlines = [ParticipantCarInline]


@admin.register(ParticipantCar)
class ParticipantCarAdmin(admin.ModelAdmin):
    list_display = ("owner", "make", "model", "year", "engine", "created_at")
    list_filter = ("make", "year")
    search_fields = ("owner__full_name", "owner__phone", "make", "model", "engine")
    inlines = [ParticipantCarPhotoInline]


@admin.register(ParticipantCarPhoto)
class ParticipantCarPhotoAdmin(admin.ModelAdmin):
    list_display = ("car", "created_at")
