from rest_framework import serializers


class RunSerializer(serializers.Serializer):
    panels = serializers.IntegerField(min_value=1, max_value=60)


class CalculationInputSerializer(serializers.Serializer):
    rows = serializers.IntegerField(min_value=1, max_value=20, required=False)
    cols = serializers.IntegerField(min_value=1, max_value=30, required=False)
    runs = RunSerializer(many=True, required=False, allow_empty=False, max_length=100)
    roof_tilt = serializers.FloatField(min_value=0, max_value=60)
    wind_zone = serializers.IntegerField(min_value=1, max_value=4)
    snow_zone = serializers.IntegerField(min_value=1, max_value=3)

    def validate(self, attrs):
        if "runs" in attrs:
            attrs["runs"] = tuple(r["panels"] for r in attrs["runs"])
            attrs.pop("rows", None)
            attrs.pop("cols", None)
        elif "rows" not in attrs or "cols" not in attrs:
            raise serializers.ValidationError("Provide either rows and cols, or runs.")
        return attrs
