import os
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Create a superuser non-interactively from environment variables'

    def handle(self, *args, **kwargs):
        # get_user_model() respects AUTH_USER_MODEL = "accounts.User" in settings.py
        # so this works with our custom user model, not just the default Django User
        User = get_user_model()

        # Read credentials from environment — never hardcode defaults for password
        username = os.environ.get('SUPERUSER_USERNAME', 'admin')
        email    = os.environ.get('SUPERUSER_EMAIL', 'admin@example.com')
        password = os.environ.get('SUPERUSER_PASSWORD', '')

        # Bail out early if no password is set — avoids creating a locked-out account
        if not password:
            self.stdout.write('SUPERUSER_PASSWORD env var not set — skipping.')
            return

        # Idempotent: safe to run on every deploy without duplicating the superuser
        if User.objects.filter(username=username).exists():
            self.stdout.write(f'Superuser "{username}" already exists — skipping.')
            return

        User.objects.create_superuser(username=username, email=email, password=password)
        self.stdout.write(f'Superuser "{username}" created successfully.')
