"""Settings for K2 Base Lite. All deployment-specific values come from env vars."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


DEBUG = env_bool("DEBUG", False)
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-insecure-key-change-me" if DEBUG else "")
if not SECRET_KEY:
    SECRET_KEY = "dev-insecure-key-change-me"  # demo fallback; set SECRET_KEY in production
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "corsheaders",
    "rest_framework",
    "calculator",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("SQLITE_PATH", str(BASE_DIR / "db.sqlite3")),
    }
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Optional OAuth2/OIDC (e.g. Keycloak) JWT auth. Disabled by default.
AUTH_ENABLED = env_bool("AUTH_ENABLED", False)
OIDC_ISSUER = os.environ.get("OIDC_ISSUER", "")  # e.g. https://kc.example.com/realms/k2
OIDC_AUDIENCE = os.environ.get("OIDC_AUDIENCE", "")

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_AUTHENTICATION_CLASSES": (
        ["calculator.auth.KeycloakJWTAuthentication"] if AUTH_ENABLED else []
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        ["rest_framework.permissions.IsAuthenticated"]
        if AUTH_ENABLED
        else ["rest_framework.permissions.AllowAny"]
    ),
    "UNAUTHENTICATED_USER": None,
}
