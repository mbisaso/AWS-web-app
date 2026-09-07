from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import RegisterSerializer


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
    return Response(
        {
            'success': True,
            'message': 'Account created',
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

