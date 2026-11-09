"""Optional Keycloak / OAuth2 bearer-token auth hook (stub).

Enabled only when AUTH_ENABLED=true. Validates an RS256 JWT against the
issuer's JWKS (OIDC_ISSUER + /protocol/openid-connect/certs, Keycloak layout)
and checks audience (OIDC_AUDIENCE). No user DB lookup: the token claims are
exposed as request.user (a lightweight object) for this stateless demo.
"""

from types import SimpleNamespace

import jwt
from django.conf import settings
from rest_framework import authentication, exceptions

_jwks_client = None


def _client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(
            settings.OIDC_ISSUER.rstrip("/") + "/protocol/openid-connect/certs"
        )
    return _jwks_client


class KeycloakJWTAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return None
        token = header.removeprefix("Bearer ").strip()
        try:
            key = _client().get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=settings.OIDC_AUDIENCE or None,
                issuer=settings.OIDC_ISSUER,
                options={"verify_aud": bool(settings.OIDC_AUDIENCE)},
            )
        except jwt.PyJWTError as exc:
            raise exceptions.AuthenticationFailed(f"Invalid token: {exc}") from exc
        user = SimpleNamespace(
            is_authenticated=True, username=claims.get("preferred_username"), claims=claims
        )
        return user, token

    def authenticate_header(self, request):
        return "Bearer"
