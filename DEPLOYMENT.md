# 🚀 AdEMNEA Network: Full-Stack Deployment Guide

Welcome to the WIMEA-ICT Automatic Weather Station (AWS) dashboard project!

This application is hosted on a shared **cPanel environment with no Terminal/SSH access**. Because of these server restrictions, standard CI/CD pipelines cannot be used. We rely on a specific "Zip & Upload" workflow, utilizing cPanel's File Manager, Application Manager, and automated Cron Jobs to execute server-side terminal commands.

Please follow these instructions exactly to ensure zero downtime and prevent version conflicts.

---

## 🛠️ 1. Backend Deployment (Django + ML Monolith)

The backend is served via Phusion Passenger. We use a monolithic architecture, meaning the Machine Learning models (Isolation Forest) are loaded directly into Django's RAM rather than running as a separate microservice. 

When you make changes to Python files (`views.py`, `models.py`, `urls.py`, etc.), or update the `.joblib` ML model, follow these steps to push them live.

### Step 1: Prep and Zip Locally

1. Ensure your local code is fully tested.
2. Open your local `backend` folder.
3. **CRITICAL:** Select your project files, but **DO NOT** include the following:
   * The `.venv` or `venv` folder (cPanel manages its own virtual environment).
   * Your local `.env` file (you do not want to overwrite the production database credentials).
   * Any `__pycache__` directories.
4. Zip the remaining files into `backend_update.zip`.

### Step 2: Upload via cPanel

1. Log into cPanel and open **File Manager**.
2. Navigate to the backend application folder (e.g., `/home/wimeaadmin/aws_backend`).
3. Upload your `backend_update.zip` file.
4. Extract the zip to overwrite the existing Python files, then **delete the zip file** to save server space.

### Step 3: Manage Dependencies (If `requirements.txt` Changed)

If you add new packages (like an update to `scikit-learn` or `pandas`), you must install them. Because we have no SSH access, you can do this in one of two ways:

#### Method A: The cPanel GUI (Preferred if available)
1. Go to **Setup Python App** in cPanel.
2. Edit your running application.
3. Scroll down to "Configuration files". Type `requirements.txt` and click **Add**.
4. Click the **Run Pip Install** button.

#### Method B: The Cron Job Fallback (Using `--user` flag)
If the GUI fails or is unavailable, use the system pip with a user-level install via Cron Job.
1. Go to **Cron Jobs** in cPanel.
2. Add a new **Once Per Minute (\* \* \* \* \*)** job with the following command:
   ```bash
   cd /home/wimeaadmin/aws_backend && /usr/bin/pip3 install --user -r requirements.txt > cron_log.txt 2>&1
   ```

> [!IMPORTANT]
> Wait exactly one minute, verify `cron_log.txt` shows success in the File Manager, then **delete the cron job immediately**.

### Step 4: Run Migrations (If Database Models Changed)
If your update includes changes to `models.py`, you must update the production database.

1. In cPanel, open **Cron Jobs**.
2. Add a new **Once Per Minute (\* \* \* \* \*)** job with the following command:
   ```bash
   cd /home/wimeaadmin/aws_backend && /usr/bin/python3 manage.py migrate > cron_migrate.txt 2>&1
   ```

> [!IMPORTANT]
> Wait one minute, verify `cron_migrate.txt` says "Applying...", then **delete the cron job immediately**.

### Step 5: Hard Restart Phusion Passenger (CRITICAL)
Uploading new Python files or a new `.joblib` ML model does not automatically apply the changes. Phusion Passenger caches the app in RAM. You must force a restart.

1. In cPanel File Manager, navigate to your app root: `/home/wimeaadmin/aws_backend/`.
2. Look for a folder named `tmp`. If it does not exist, create it.
3. Inside `tmp/`, create a blank text file named exactly: `restart.txt`

> [!NOTE]
> The next time the API is hit via a web browser or ESP32 post, Passenger will see this file, kill the old Python process, load the new code (and ML model) into RAM, and clear the file.

---

## 💻 2. Frontend Deployment (React/Vite)
Because the frontend is a compiled Single Page Application (SPA), it does not require Phusion Passenger or a running Node server on cPanel. It is served entirely as static HTML/JS/CSS files.

### Step 1: Build Locally
1. On your local machine, open a terminal in the `frontend` folder.
2. Run the build command:
   ```bash
   npm run build
   ```
   This generates a `dist` folder containing the optimized, minified production files.

### Step 2: Zip and Upload
1. Zip the contents of the `dist` folder (do not zip the `dist` folder itself; zip the `index.html` and `assets` folder inside it).
2. Go to cPanel **File Manager**.
3. Navigate to the `public_html` directory (or the specific subdomain folder where the frontend is hosted).
4. Delete the old frontend files.
5. Upload your new zip file and extract it.
6. Delete the zip file. The new frontend is now live.

---

## 🚨 Troubleshooting

> [!WARNING]
> **503 Service Unavailable:** This often means the Python app ran out of RAM when loading the ML model, or there is a syntax error in `passenger_wsgi.py`. Check the cPanel **Resource Usage** tab (or AWStats). If Physical Memory is maxed out, request a limit bump.

> [!WARNING]
> **CORS Errors:** Ensure the frontend URL is correctly listed in the Django `settings.py` under `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`.
