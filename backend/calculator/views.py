from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from . import geo
from .serializers import CalculationInputSerializer
from .services import CalculationInput, calculate


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})


@api_view(["POST"])
def calculate_view(request):
    serializer = CalculationInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    result = calculate(CalculationInput(**serializer.validated_data))
    return Response(result.to_dict())


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def geocode_view(request):
    q = request.query_params.get("q", "").strip()
    if not 3 <= len(q) <= 200:
        return Response({"q": ["Must be 3..200 characters."]}, status=400)
    try:
        return Response(geo.geocode(q))
    except geo.UpstreamError:
        return Response({"detail": "Geocoding service unavailable."}, status=502)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def footprint_view(request):
    try:
        lat = float(request.query_params["lat"])
        lon = float(request.query_params["lon"])
        if not (-85 <= lat <= 85 and -180 <= lon <= 180):
            raise ValueError
    except (KeyError, ValueError):
        return Response({"detail": "lat (-85..85) and lon (-180..180) are required."}, status=400)
    try:
        poly = geo.footprint(lat, lon)
    except geo.UpstreamError:
        return Response({"detail": "Footprint service unavailable."}, status=502)
    if poly is None:
        return Response({"detail": "No building found."}, status=404)
    return Response({"polygon": poly})
