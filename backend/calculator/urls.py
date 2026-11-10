from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("calculate/", views.calculate_view, name="calculate"),
    path("geocode/", views.geocode_view, name="geocode"),
    path("footprint/", views.footprint_view, name="footprint"),
]
