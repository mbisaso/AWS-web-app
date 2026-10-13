# Daily Performance Report Email Deployment

This guide deploys the daily station performance email on the project's cPanel/Passenger hosting. The scheduler is a cPanel cron job that invokes Django once per minute. Django checks the configured `Africa/Kampala` send time and sends at most once per local day; no worker service or running web request is required.

## 1. Upload the report changes

Upload the report and email-service source files with the normal backend deployment. Include the new stations migrations and `requirements.txt`. Do not upload a local `.env`, `.venv`, database dump, or local test data.

Use the regular cPanel deployment instructions in [DEPLOYMENT.md](../DEPLOYMENT.md) for packaging and Passenger restart steps.

## 2. Install dependencies

The report PDF attachment uses ReportLab. In cPanel:

1. Open **Setup Python App** and select the Django application.
2. Add `requirements.txt` to its configuration files if it is not already listed.
3. Run **Run Pip Install** and confirm it completes successfully.

## 3. Configure production email settings

Set these variables in the Python application's environment-variable settings in cPanel. Use the SMTP credentials issued by your mail provider. Do not put production credentials in GitHub or in the deployment archive.

```text
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=reports@example.com
EMAIL_HOST_PASSWORD=<provider-issued-app-password>
DEFAULT_FROM_EMAIL=AWS Monitor <reports@example.com>
```

For Gmail, use a Google App Password created for an account with 2-Step Verification enabled; never use the account's normal password. Keep `DEFAULT_FROM_EMAIL` aligned with the SMTP account or an authorized sender. If the host blocks outbound SMTP, use the hosting provider's SMTP relay or an approved transactional email provider instead.

The app also needs its existing production database and Django environment variables configured in cPanel. Do not copy the local `backend/.env` to the server.

## 4. Apply database migrations

Use the Python executable shown by **Setup Python App** for this application. Replace the example paths with the actual cPanel paths:

```sh
/home/CPANEL_USER/virtualenv/aws_backend/3.14/bin/python /home/CPANEL_USER/aws_backend/manage.py migrate
```

If cPanel has no interactive terminal, add this command as a temporary cron job that runs once, then remove it after confirming the migration output. Use the same virtual-environment Python for every command in this guide.

## 5. Configure recipients and delivery time

1. Open the production Django Admin and sign in with a staff/superuser account.
2. Open **Stations > Daily performance report settings**.
3. Select **Admins**, **All active users**, or **Selected users**. For individual recipients, choose **Selected users** and add active accounts with email addresses.
4. Set the desired time. It is interpreted in `Africa/Kampala` regardless of the server's timezone.
5. Save the settings, but leave delivery disabled until the dry run and mail setup have been checked.

The previous calendar day's performance report is sent as an HTML email with a PDF attachment. Recipients are BCC'd.

## 6. Verify without sending

Create a temporary cPanel cron job to run the dry run once. Set its command to the following, replacing the paths:

```sh
/home/CPANEL_USER/virtualenv/aws_backend/3.14/bin/python /home/CPANEL_USER/aws_backend/manage.py send_daily_performance_report --dry-run >> /home/CPANEL_USER/aws_backend/daily_report_dry_run.log 2>&1
```

After the job runs, inspect `daily_report_dry_run.log` in cPanel File Manager. Confirm it reports the expected recipient count and registered station count, then remove the temporary cron job and the log when no longer needed. Dry run does not send email or mark the report as sent.

If you need to verify SMTP delivery, use a controlled recipient and a one-off test email or a deliberate `--force` run only after checking the configured recipient selection. A forced report sends immediately and marks that local day as sent.

## 7. Add the recurring cron job

In cPanel **Cron Jobs**, add a job that runs every minute. The command should be:

```sh
/home/CPANEL_USER/virtualenv/aws_backend/3.14/bin/python /home/CPANEL_USER/aws_backend/manage.py send_daily_performance_report >> /home/CPANEL_USER/aws_backend/daily_report_cron.log 2>&1
```

The command exits without sending when delivery is disabled, the configured time has not arrived, or a report was already sent that day. After the first successful send, Django records the local send date to prevent duplicates if cron invokes the command again.

Keep the server, database, application environment variables, and cron job available at the configured delivery time. Check `daily_report_cron.log` after the first scheduled run, then periodically rotate or clear the log to control disk usage.

## Troubleshooting

- **No email arrives:** Confirm `enabled` is checked, the configured send time has passed in Kampala time, and the user accounts are active and have email addresses.
- **Authentication or connection error:** Recheck the SMTP host, port, TLS setting, sender account, and provider-issued password. Some hosts require their own SMTP relay.
- **No selected recipients:** Confirm **Selected users** is chosen and users appear in the selected side of the admin multi-select.
- **Migrations missing:** Run `migrate` using the application's cPanel virtualenv Python, not the server's unrelated system Python.
- **Duplicate prevention:** A successful send is recorded in `last_sent_on`. Do not reset it to force a send unless you intend to send another report that day; use `--force` only for deliberate testing.
