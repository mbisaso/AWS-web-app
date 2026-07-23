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
    email = request.data.get('email')
    password = request.data.get('password')

    user = authenticate(request, username=email, password=password)
    if user is None:
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
            'email':    user.email,
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

