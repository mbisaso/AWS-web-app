# 🚀 AdEMNEA Network: Full-Stack Deployment Guide (Ubuntu VPS)

Welcome to the WIMEA-ICT Automatic Weather Station (AWS) dashboard project!

The application now runs on the **Ubuntu VPS `ademnea`** (Ubuntu 22.04, Apache 2.4, MySQL 8). It was migrated from cPanel. **The old "Zip & Upload via cPanel" workflow no longer applies**: there is no cPanel, no Phusion Passenger, no `restart.txt`, and no cron-job tricks to run commands. You deploy over **SSH** with `git`, `rsync` and `systemctl`.

> [!WARNING]
> **This is a shared server.** Besides the AWS dashboard it also runs other production systems (FIDS, MNRAW, BSADS, SmartHive, IoT-RA, TMS and others). Only touch the AWS backend, the AWS frontend folder and the AWS Apache vhosts. Never kill or restart a process you did not start for this project.

---

## 🗺️ 1. How the server is laid out

| Item | Value |
|---|---|
| Server | `ademnea` (`196.43.168.57`), Ubuntu 22.04. The server clock is **UTC**; Kampala is UTC+3. |
| GitHub repo | `https://github.com/mbisaso/AWS-web-app` (folders: `backend/`, `frontend/`). Releases are currently deployed from branch **`marvin`**; `main` may lag behind, so always check. |
| Backend code (live) | `/var/www/wimea-ict.net/aws_backend` (Django). **Not a git repo.** It also holds `venv/`, `.env` and `staticfiles/`, which must never be overwritten. |
| Backend service | systemd unit **`aws-backend.service`**: gunicorn on `127.0.0.1:8002` (module `aws_dashboard.wsgi:application`). |
| Staging checkout | `~/deploy-src` on the server (a git clone you pull into, then copy from). |
| Frontend (live) | `/var/www/wimea-ict.net/public_html/aws.wimea-ict.net` (static React/Vite build + `.htaccess` SPA rewrite rules). |
| Dashboard domain | `https://aws.wimea-ict.net`. Apache serves the static files and proxies `/api/`, `/admin/` and `/static/admin/` to Django on port 8002. |
| Stations' domain | `api.wimea-ict.net`. Apache proxies everything to Django on port 8002. **The ESP32 stations post here.** |
| Database | MySQL 8 on `127.0.0.1:3306`, database `wimeaadmin_awsdb`, user `wimeaadmin_awsuser`. Not exposed to the internet. |
| TLS | Let's Encrypt (certbot). One certificate covers `wimea-ict.net`, `aws.wimea-ict.net` and `api.wimea-ict.net` (stored under `/etc/letsencrypt/live/wimea-ict.net-0001/`). |
| ML model | Embedded in Django (loaded from `backend/ml/models/*.joblib`). There is no separate ML service. |

Apache vhost files live in `/etc/apache2/sites-available/` (`aws.wimea-ict.net*.conf`, `api.wimea-ict.net*.conf`).

---

## ✅ 2. Golden rules

1. **Never overwrite `.env`, `venv/` or `staticfiles/`** on the server. Every copy command below excludes them.
2. **The stations must keep working.** The ESP32/GSM stations post to `api.wimea-ict.net`. That hostname must stay in `DJANGO_ALLOWED_HOSTS` (see §7), or **every station request is rejected with HTTP 400 and data stops**. Never edit the `api.wimea-ict.net` Apache vhost without agreeing it with the hardware team (the SIM800L modem cannot do HTTPS or follow redirects).
3. **Back up before every deploy** (database and code). See §5.1.
4. **Never use `rsync --delete` on the frontend folder.** It also contains `.well-known/` (certificate renewals), `cgi-bin/` and `.htaccess`.
5. **Restart only through systemd**: `sudo systemctl restart aws-backend.service`. Never start gunicorn by hand on port 8002. A stray process holding the port makes the service crash-loop (see §11).
6. **Settings load at start-up.** After changing `.env` or any Python file, you must restart the service.
7. **Do not leave backups (`*.zip`, `*.sql`) in the public web folder.** Keep them in `~/backups`.
8. **Never paste secrets** (passwords, tokens, reset links, `.env` contents) into chats, tickets or the repo.

> [!NOTE]
> The stations keep readings on an SD card and resend them after an outage, so a service restart of a few seconds loses no data. A longer outage is also recovered, but the dashboard stays behind until the station's upload catches up.

---

## 🧰 3. Before you start

* An SSH account on `ademnea` with `sudo` rights, plus access to the GitHub repo.
* Locally: Git, Node.js/npm. On **Windows**, `rsync` is not available in PowerShell, so use the `ssh`/`scp` method in §6.
* Know the branch you are releasing (`git branch --show-current`).

---

## 🧪 4. Prepare and push (on your PC)

1. Test locally and commit **everything the release needs**: code, new migration files, `requirements.txt`, and `backend/.env.example` if you added settings.
2. Check `backend/aws_dashboard/settings.py` still reads `ALLOWED_HOSTS` from the environment and defaults to include both production hosts:
   ```python
   ALLOWED_HOSTS = _csv_env(
       'DJANGO_ALLOWED_HOSTS',
       'api.wimea-ict.net,aws.wimea-ict.net,localhost,127.0.0.1',
   )
   ```
3. Frontend: the production API base URL (`frontend/src/api/client.ts`) must be `https://aws.wimea-ict.net` with **no trailing slash and no `/api`** (request paths already include `/api`). `vite.config.ts` only affects `npm run dev`.
4. Push:
   ```bash
   git add <files>
   git commit -m "describe the change"
   git push origin <your-branch>
   ```

---

## 🐍 5. Backend deployment (Django + ML)

Run these on the server over SSH.

### 5.1 Back up

```bash
mkdir -p ~/backups ~/logs
mysqldump -u wimeaadmin_awsuser -p -h 127.0.0.1 --single-transaction --no-tablespaces wimeaadmin_awsdb > ~/backups/awsdb_$(date +%F_%H%M).sql
tail -n 2 ~/backups/$(ls -t ~/backups | grep awsdb | head -n 1)     # must end with "-- Dump completed"
tar --exclude='venv' --exclude='staticfiles' -czf ~/backups/aws_backend_$(date +%F_%H%M).tar.gz -C /var/www/wimea-ict.net aws_backend
```

At the MySQL password prompt, type the **real** password. (The `%40`-style encoding in `.env` is only for URLs.)

### 5.2 Fetch the code into the staging folder

```bash
# first time only:
git clone -b <branch> https://github.com/mbisaso/AWS-web-app.git ~/deploy-src

cd ~/deploy-src && git fetch && git checkout <branch> && git pull origin <branch>
git log --oneline -3      # confirm this is the commit you meant to deploy
```

### 5.3 Pre-flight checks (do not skip)

```bash
grep -n -A4 "^ALLOWED_HOSTS" backend/aws_dashboard/settings.py     # must read _csv_env( and include api.wimea-ict.net
ls backend/stations/migrations | tail -n 5                          # new migrations present?
```

If `settings.py` hardcodes a host list without `api.wimea-ict.net`, **stop and fix the repo first**, otherwise the stations are rejected as soon as the service restarts.

### 5.4 Dry-run, then copy

```bash
# Dry run (-n): lists what WOULD change, touches nothing
rsync -avn --exclude='.env' --exclude='venv/' --exclude='staticfiles/' --exclude='__pycache__/' --exclude='*.pyc' \
  ~/deploy-src/backend/ /var/www/wimea-ict.net/aws_backend/
```

The list should contain only files you changed. `.env` and `venv/` must **not** appear. If it looks right, run the same command again **without `-n`**. (There is deliberately no `--delete`, so server-only files such as the ML model survive.)

### 5.5 Dependencies, migrations, static files

```bash
cd /var/www/wimea-ict.net/aws_backend && source venv/bin/activate
sed -i 's/\r$//' .env                       # make sure .env has Unix (LF) line endings
pip install -r requirements.txt
python manage.py migrate --plan             # read it: only the migrations you expect?
python manage.py migrate
python manage.py collectstatic --noinput
```

If `--plan` shows anything unexpected (or errors such as "table already exists"), stop and ask before running `migrate`.

### 5.6 Restart and verify

```bash
sudo systemctl restart aws-backend.service; sleep 5
sudo systemctl status aws-backend.service --no-pager | head -n 8
python manage.py shell -c "from django.conf import settings; print(settings.ALLOWED_HOSTS)"
curl -s -X POST https://api.wimea-ict.net/api/ingest/weather/ -H "Content-Type: application/json" -d '{}' -w '\nHTTP %{http_code}\n'
```

Expected:

* The printed list contains **`api.wimea-ict.net`** and **`aws.wimea-ict.net`**.
* The curl returns `{"success":false,"error":"timestamp is required..."}` (HTTP 400 from the ingest view itself). That proves the request got past the host check.
* A plain `Bad Request (400)` page means the host is rejected (see §11). A `503` right after restart just means gunicorn is still starting; wait a few seconds.

---

## ⚛️ 6. Frontend deployment (React/Vite)

The frontend is a compiled single-page app, served as static files. **Build on your PC, never on the server.**

### 6.1 Build locally

```bash
cd frontend
npm install
npm run build
```

Sanity-check the build points at production:

```bash
grep -rho "https://[a-z.]*wimea-ict.net" dist/assets | sort | uniq -c      # expect aws.wimea-ict.net only
```

### 6.2 Upload to a staging folder on the server

Works from Windows PowerShell, macOS and Linux:

```powershell
ssh <user>@196.43.168.57 "rm -rf ~/dist-upload && mkdir -p ~/dist-upload"
scp -r .\dist\* <user>@196.43.168.57:~/dist-upload/
```

(Linux/macOS users can instead `rsync -avz ./dist/ <user>@196.43.168.57:~/dist-upload/`.)

### 6.3 Copy into the live folder (on the server)

```bash
DOCROOT=/var/www/wimea-ict.net/public_html/aws.wimea-ict.net
cp $DOCROOT/.htaccess ~/htaccess.bak                       # safety copy of the SPA rewrite rules

sudo rsync -rltv --no-owner --no-group --chmod=D755,F644 --exclude='.htaccess' ~/dist-upload/ $DOCROOT/

diff $DOCROOT/.htaccess ~/htaccess.bak && echo "htaccess unchanged"
curl -s https://aws.wimea-ict.net/ | grep -o 'assets/index-[^"]*'      # should show the NEW bundle names
```

> [!IMPORTANT]
> Do **not** add `--delete` here (see rule 4). Old bundles are harmless. To tidy up, remove only the old `assets/index-*.js/.css` files by name.

Test in a private/incognito window to avoid a cached bundle.

---

## 🔐 7. Server `.env` reference

File: `/var/www/wimea-ict.net/aws_backend/.env`. It is **not** in git and **not** overwritten by deploys. Edit with `nano`, then restart the service.

| Variable | Production value / notes |
|---|---|
| `SECRET_KEY` | Long random string. Keep private. |
| `DEBUG` | `False` |
| `DATABASE_URL` | `mysql://wimeaadmin_awsuser:<password>@localhost:3306/wimeaadmin_awsdb`. **Special characters in the password must be percent-encoded** (for example `@` becomes `%40`), or the URL parses wrongly. |
| `DJANGO_ALLOWED_HOSTS` | `api.wimea-ict.net,aws.wimea-ict.net,localhost,127.0.0.1` |
| `CSRF_TRUSTED_ORIGINS` | `https://aws.wimea-ict.net` (add `https://api.wimea-ict.net` if you use `/admin` there) |
| `CORS_ALLOWED_ORIGINS` | `https://aws.wimea-ict.net` |
| `FRONTEND_URL` | `https://aws.wimea-ict.net` (no trailing slash). Used to build password-reset links; if it is wrong, emails link to `localhost`. |
| `EMAIL_BACKEND` | `django.core.mail.backends.smtp.EmailBackend` (the default is the console backend, which sends nothing) |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS` | e.g. `smtp.gmail.com`, `587`, `True` |
| `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | Sender account and its **Google App Password** (not the normal login password). |
| `DEFAULT_FROM_EMAIL` | Use the **same address** as `EMAIL_HOST_USER`, or Gmail may reject the mail. |
| `NOTIFICATION_EMAIL` | Admin address that receives new-registration approval requests. |

Rules for this file: **LF line endings only** (`sed -i 's/\r$//' .env`; a stray `^M` can corrupt values), and never commit it.

To print it without showing secrets: `grep -E "^(EMAIL_|DEFAULT_FROM|NOTIFICATION|FRONTEND|DJANGO_|CSRF|CORS)" .env | sed -E 's/(PASSWORD=).*/\1****/'`

---

## 📧 8. Scheduled performance report (cron)

The report e-mail is produced by `python manage.py send_daily_performance_report`. Read `DAILY_REPORT_EMAIL_DEPLOYMENT.md` in the repo for how it schedules itself.

1. Check the e-mail settings in §7, then test: `python manage.py send_daily_performance_report --dry-run` (prints recipient count, station count and PDF size).
2. Add the cron job **on the server** (`crontab -e`). The log goes to your home folder, because `/var/log` is not writable:
   ```
   * * * * * cd /var/www/wimea-ict.net/aws_backend && /var/www/wimea-ict.net/aws_backend/venv/bin/python manage.py send_daily_performance_report >> /home/<user>/logs/daily_report_cron.log 2>&1
   ```
3. Enable it in the admin: `https://aws.wimea-ict.net/admin/` → Stations → Daily performance report settings. For the first test choose **Selected users** (just yourself) and a send time a few minutes ahead. **The server clock is UTC**, so Kampala 08:00 is 05:00 UTC; check how the send time is interpreted in the settings page.
4. After the test e-mail looks right, widen the recipient group.

---

## 🔎 9. Post-deployment checklist

- [ ] `sudo systemctl status aws-backend.service` shows `active (running)`, with no restart loop.
- [ ] `ALLOWED_HOSTS` printed in §5.6 includes both hosts, and the curl test gives the "timestamp is required" reply.
- [ ] After the next station upload: `sudo grep ingest /var/log/apache2/api.wimea-ict.net-access.log | tail -n 6` shows **`201`** on the weather, voltage and current lines.
- [ ] In an incognito window: log in at `https://aws.wimea-ict.net`, confirm DevTools → Network shows `login/` going to `https://aws.wimea-ict.net/api/login/`, and open the pages you changed.
- [ ] Password reset e-mail links point to `https://aws.wimea-ict.net/...`, not `localhost`.
- [ ] The new data shows up: compare the dashboard's latest reading with `SELECT MAX(timestamp), MAX(received_at) FROM stations_weatherreading;`.

---

## ⏪ 10. Rollback

```bash
# Code
sudo systemctl stop aws-backend.service
tar -xzf ~/backups/aws_backend_<timestamp>.tar.gz -C /var/www/wimea-ict.net

# Only if a migration must be undone (replace <last_good> with the previous migration number, e.g. 0010)
cd /var/www/wimea-ict.net/aws_backend && source venv/bin/activate
python manage.py migrate stations <last_good>

sudo systemctl start aws-backend.service
```

If data itself was damaged, restore the SQL dump from `~/backups` (with the service stopped). For the frontend, rebuild the previous commit and copy its `dist/` as in §6. For a bad Apache change: restore the file, then `sudo apache2ctl configtest && sudo systemctl reload apache2`.

---

## 🚨 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Stations stop; the Apache log shows `400` for `/api/ingest/...`; the Django log says `Invalid HTTP_HOST header` | `api.wimea-ict.net` missing from `ALLOWED_HOSTS` | Fix `DJANGO_ALLOWED_HOSTS` in `.env` **and** check `settings.py` reads it (§5.3), restart, and test with the §5.6 curl. |
| Login shows "Invalid email or password" but the browser console shows `POST /api/login/ 500` | Server error, not a bad password. Read the traceback: `sudo journalctl -u aws-backend.service -n 80 --no-pager` | A known cause: two users with the same e-mail (`get() returned more than one User`). Find the duplicates in `python manage.py shell` and remove or rename one. |
| `aws-backend.service` restart counter keeps rising; log says `Address already in use` on port 8002 | A leftover gunicorn started by hand holds the port | `sudo systemctl stop aws-backend.service`, find it with `sudo ss -tlnp \| grep :8002`, stop only that process (`sudo kill -TERM <pid>`), then `sudo systemctl start aws-backend.service`. |
| `503 Service Unavailable` immediately after a restart | gunicorn is still starting | Wait 5 to 10 seconds. If it persists, check `systemctl status` and the journal. |
| Plain `500` on an endpoint with no detail | `DEBUG=False` hides errors | Tracebacks are printed to the journal (a `LOGGING` block in `settings.py` sends `django.request` errors to the console). Use `journalctl -u aws-backend.service -n 100`. |
| Dashboard shows old data, but stations are sending `201` | Station upload is behind (SD-card backlog), or the page was not refreshed | Compare device time and arrival time: `SELECT MAX(timestamp), MAX(received_at) FROM stations_weatherreading WHERE station_code='AWS-UG-001';`. Large gaps mean the station is uploading late; contact the hardware team. |
| `/admin/` loads without styling (black squares) | `/static/admin/` is not proxied to Django | In `aws.wimea-ict.net-le-ssl.conf` add a `<Location /static/admin/>` block with `ProxyPass`/`ProxyPassReverse` to `http://127.0.0.1:8002/static/admin/`, then `sudo apache2ctl configtest && sudo systemctl reload apache2`. |
| Password-reset or approval e-mails not arriving, or link points to `localhost` | `.env` e-mail settings or `FRONTEND_URL` wrong (or service not restarted) | Fix `.env` (§7), restart, test with `python manage.py shell -c "from django.core.mail import send_mail; send_mail('t','ok',None,['you@example.com'])"`. If it hangs, outbound port 587 may be blocked. |
| `mysqldump: ... need the PROCESS privilege` | Missing flag | Add `--no-tablespaces`. |
| `rsync: ... Permission denied` on the frontend folder | The folder is owned by another user | Use the `sudo rsync -rltv --no-owner --no-group ...` command in §6.3 (no `--delete`). |
| Frontend still shows the old version after deploying | Cached bundle, or the copy did not happen | `curl -s https://aws.wimea-ict.net/ \| grep -o 'assets/index-[^"]*'` and compare with your local `dist/index.html`. Re-test in incognito. |
| MySQL stops / "Can't connect to MySQL server" | Out of memory (the OOM killer chose `mysqld`) | `free -h`; `sudo dmesg -T \| grep -i -E "out of memory\|killed process"`. Do not start extra heavy processes; escalate to the server administrator. |

---

## 🧾 12. Handy commands

```bash
# Service
sudo systemctl status aws-backend.service --no-pager
sudo systemctl restart aws-backend.service
sudo journalctl -u aws-backend.service -f            # live log (Ctrl+C to stop)

# Stations: are they being accepted?
sudo grep ingest /var/log/apache2/api.wimea-ict.net-access.log | tail -n 10

# Apache: test config, then reload (reload, not restart)
sudo apache2ctl configtest && sudo systemctl reload apache2

# Which process owns a port? (check before using any port)
sudo ss -tlnp | grep :8002

# Server health
free -h; uptime; df -h /

# Django shell (inside the venv)
cd /var/www/wimea-ict.net/aws_backend && source venv/bin/activate && python manage.py shell
```

> [!WARNING]
> **Security reminders.** `/admin/` is reachable from the internet, so use strong unique passwords and consider restricting it by IP. Only staff accounts (`is_staff=True`) can sign in there. Keep database dumps and zips out of the web folder. Adding a new subdomain? Expand the existing certificate (`sudo certbot --apache -d wimea-ict.net -d aws.wimea-ict.net -d api.wimea-ict.net -d <new> --expand`) instead of issuing a separate one.