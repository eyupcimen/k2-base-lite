from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

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
