from django.contrib.auth import authenticate, get_user_model
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.mail import send_mail
from django.conf import settings
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import status
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str

from .serializers import RegisterSerializer, CustomTokenObtainPairSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def login_api(request):
    raw_identifier = request.data.get('email') or request.data.get('username') or ''
    identifier = raw_identifier.strip()
    password = request.data.get('password')

    if not identifier or not password:
        return Response(
            {'success': False, 'error': 'Invalid username or password'},
            status=401,
        )

    # Attempt direct authenticate first
    user = authenticate(request, username=identifier, password=password)

    # If direct username auth failed, try finding user by email or username (case-insensitive)
    if user is None:
        from .models import User
        from django.db.models import Q
        matched_user = User.objects.filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        ).first()
        if matched_user:
            user = authenticate(request, username=matched_user.username, password=password)

    if user is None or not user.is_active:
        return Response(
            {'success': False, 'error': 'Invalid username or password'},
            status=401,
        )

    refresh = RefreshToken.for_user(user)
    return Response({
        'success': True,
        'message': 'Login successful',
        'data': {
            'access':   str(refresh.access_token),
            'refresh':  str(refresh),
            'email':    user.email or user.username,
            'role':     user.role,
        },
    })

User = get_user_model()

@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def register_api(request):
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'success': False, 'error': serializer.errors},
            status=400,
        )

    user = serializer.save()

    # Deactivate the account immediately to prevent unauthorized login
    user.is_active = False
    user.save()

    # Trigger a notification user to the admin email
    try:
        send_mail(
            subject='New User Account Pending Approval',
            message=f"User {user.email} has registered and is waiting for approval.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.NOTIFICATION_EMAIL],
            fail_silently=True,
        )
    except Exception:
        pass

    return Response(
        {
            'success': True,
            'message': 'Account created. Your account is pending administrative approval.',
            'data': {
                'email': user.email,
                'role':  user.role,
            },
        },
        status=201,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def logout_api(request):
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        return Response({'success': True, 'message': 'Logout successful'}, status=200)
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=400)

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        if 'email' in request.data and 'username' not in request.data:
            request.data['username'] = request.data['email']
            
        email = request.data.get('email', '').strip()
        
        # Absolute Fail-Safe Check: Intercept BEFORE the serializer runs
        try:
            user = User.objects.get(email__iexact=email)
            if not user.is_active:
                return Response(
                    {"detail": "Your account is pending administrative approval. You will receive an email once activated."},
                    status=status.HTTP_401_UNAUTHORIZED
                )
        except User.DoesNotExist:
            pass # Let it fall through to standard error checking if user doesn't exist
            
        return super().post(request, *args, **kwargs)

@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def password_reset_request_api(request):
    email = request.data.get('email', '').strip()
    if not email:
        return Response({'success': False, 'error': 'Email is required.'}, status=400)

    try:
        user = User.objects.get(email__iexact=email)

        #Generating a highly sensitive token tied to a specific user
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # building a dynamic recovery link
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
        reset_link = f"{frontend_url}/reset-password?uid={uid}&token={token}"
        
        send_mail(
            subject='Password Reset Recovery Link',
            message=f"Click the link below to securely update your password:\n\n{reset_link}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except User.DoesNotExist:
        pass

    return Response({
        'success': True,
        'message': 'If an account matches that email, a recovery link has been generated.'
    }, status=200)

@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def password_reset_confirm_api(request):
    uidb64 = request.data.get('uid')
    token = request.data.get('token')
    new_password = request.data.get('password')

    if not all([uidb64, token, new_password]):
        return Response({'success': False, 'error': 'Missing parameters.'}, status=400)

    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)

        #verifying that the link is valid, genuine
        if default_token_generator.check_token(user, token):
            user.set_password(new_password)
            user.save()
            return Response({'success': True, 'message': 'Password has been reset successfully.'}, status=200)
        else:
            return Response({'success': False, 'error': 'The link is invalid or has expired.'}, status=400)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response({'success': False, 'error': 'Invalid request parameters.'}, status=400)