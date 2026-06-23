from rest_framework import serializers
from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role     = serializers.ChoiceField(
        choices=User.Role.choices,
        default=User.Role.VIEWER,
        required=False,
    )

    class Meta:
        model  = User
        fields = ['username', 'password', 'role']

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            role=validated_data.get('role', User.Role.VIEWER),
        )
