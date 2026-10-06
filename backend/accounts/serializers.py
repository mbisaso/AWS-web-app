from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User
from django.contrib.auth import get_user_model


class RegisterSerializer(serializers.ModelSerializer):
    password   = serializers.CharField(write_only=True, min_length=8)
    email      = serializers.EmailField(required=True)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name  = serializers.CharField(required=False, allow_blank=True, max_length=150)

    class Meta:
        model  = User
        fields = ['email', 'first_name', 'last_name', 'password']

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError('A user with that email already exists.')
        # Ensure username (which will be set to email) doesn't conflict
        if User.objects.filter(username__iexact=normalized).exists():
            raise serializers.ValidationError('A user with that email already exists.')
        return normalized

    def create(self, validated_data):
        email = validated_data['email'].strip().lower()
        return User.objects.create_user(
            username=email,
            password=validated_data['password'],
            email=email,
            first_name=validated_data.get('first_name', '').strip(),
            last_name=validated_data.get('last_name', '').strip(),
            role=User.Role.ADMIN,
        )

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Dynamically balance alternative input property naming checks
        if "email" in attrs and not attrs.get(self.username_field):
            attrs[self.username_field] = attrs["email"]

        username = attrs.get(self.username_field)
        password = attrs.get("password")

        # 2. Fix the 500 block: Query via User model instead of missing class property
        try:
            user = User.objects.get(**{self.username_field: username})
        except User.DoesNotExist:
            raise serializers.ValidationError({"detail": "Invalid email or password."})

        # 3. Verify if the raw password string matches the encrypted hash
        if not user.check_password(password):
            raise serializers.ValidationError({"detail": "Invalid email or password."})

        # 4. Check if the account is deactivated (pending approval)
        if not user.is_active:
            raise serializers.ValidationError({
                "detail": "Your account is pending administrative approval. You will receive an email once activated."
            })

        # 5. If credentials match and the account is active, issue standard tokens
        return super().validate(attrs)