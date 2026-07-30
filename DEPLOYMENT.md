# 🚀 AdEMNEA Network: Full-Stack Deployment Guide

Welcome to the WIMEA-ICT Automatic Weather Station (AWS) dashboard project!

This application is hosted on a shared **cPanel environment with no Terminal/SSH access**. Because of these server restrictions, standard CI/CD pipelines cannot be used. We rely on a specific "Zip & Upload" workflow, utilizing cPanel's File Manager, Application Manager, and automated Cron Jobs to execute server-side terminal commands.

Please follow these instructions exactly to ensure zero downtime and prevent version conflicts.

---

## 🛠️ 1. Backend Deployment (Django)

The backend is served via Phusion Passenger. When you make changes to Python files (`views.py`, `models.py`, `urls.py`, etc.), follow these steps to push them live.

### Step 1: Prep and Zip Locally

1. Ensure your local code is fully tested.
2. Open your local `backend` folder.
3. **CRITICAL:** Select your project files, but **DO NOT** include the following:
   - The `.venv` or `venv` folder (cPanel manages its own virtual environment).
   - Your local `.env` file (you do not want to overwrite the production database credentials).
4. Zip the remaining files.

### Step 2: Upload via cPanel

1. Log into cPanel and open **File Manager**.
2. Navigate to the backend application folder (e.g., `/home/wimeaadmin/aws_backend`).
3. Upload your zip file.
4. Extract the zip to overwrite the existing Python files, then delete the zip file.

### Step 3: Run Migrations (If Database Models Changed)

If your update includes changes to `models.py`, you must update the production database. Since we lack SSH access, we use a Cron Job.

1. In cPanel, open **Cron Jobs**.
2. Add a new **Once Per Minute (\* \* \* \* \*)** job with the following command:
   ```bash
   cd /home/wimeaadmin/aws_backend && /usr/bin/python3 manage.py migrate > cron_migrate.txt 2>&1
   ```
