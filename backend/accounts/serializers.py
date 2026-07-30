from rest_framework import serializers
from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password   = serializers.CharField(write_only=True, min_length=8)
    email      = serializers.EmailField(required=True)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name  = serializers.CharField(required=False, allow_blank=True, max_length=150)

    class Meta:
        model  = User
        fields = ['email', 'first_name', 'last_name', 'password']

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with that email already exists.')
        # Ensure username (which will be set to email) doesn't conflict
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('A user with that email already exists.')
        return value

    def create(self, validated_data):
        email = validated_data['email']
        return User.objects.create_user(
            username=email,
            password=validated_data['password'],
            email=email,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=User.Role.ADMIN,
        )
