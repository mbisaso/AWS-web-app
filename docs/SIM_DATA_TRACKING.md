# SIM data tracking

The station firmware has no room for a data counter, so the server estimates each
SIM's usage from the traffic it receives. Every byte the SIM spends goes to our
ingest endpoints, so the server can count it from its side.

## How the estimate works

1. **Metering.** `SimUsageMiddleware` (`stations/sim_usage.py`) sizes every `POST /api/ingest/*`
   request, including rejected ones. It counts the request line, the headers, the body and our
   response, adds about 6% for TCP/IP and TLS framing, and adds `SIM_CONNECTION_OVERHEAD_BYTES`
   (default 5500). That fixed amount covers the DNS lookup, the TCP handshake and the full TLS
   handshake the ESP32 makes for each HTTPS post. The total is charged to the station's SIM in
   hourly `SimUsageHour` buckets.
2. **Remaining data** = *anchor balance* − `calibration_factor` × bytes counted since the anchor.
   The anchor is the last point where the balance was known:
   - the bundle load date (with the bundle size),
   - a top-up, or
   - a balance read from MTN.
3. **Projection.** The average MB/day over the last 7 days, or the expected rate
   (interval × 3 posts × bytes per post) until a full day has been measured. Days left is
   whichever comes first: the data running out or the bundle expiring.
4. **Calibration.** On the SIM panel, enter the balance MTN reports (from the USSD menu or the
   MyMTN app). The estimate restarts from that figure. `calibration_factor` is set to
   *MB MTN billed ÷ MB the server measured* since the previous anchor, kept between 0.25 and 4.
   A few checks during the first weeks are enough for the estimate to track MTN closely.

## Top-ups

A bundle bought while the current one is active is added to it, as MTN does. A bundle bought
after the current one has expired or run out starts a new cycle: the load date becomes today and
the bundle size becomes the new amount.

## Deploying

```bash
python manage.py migrate
# Optional: estimate usage before metering started, from stored readings
python manage.py backfill_sim_usage
```

## Email warnings

`python manage.py send_sim_alerts` emails a warning when a SIM's bundle is about to expire, or
when its data is projected to run out before the expiry date. A final email is sent once it has
expired or run out. By default it warns at 7, 3 and 1 days before. Each warning is sent once per
bundle. A top-up, or a new expiry date, counts as a new bundle, so its warnings start over. All
SIMs that need attention go into one email, with recipients BCC'd.

Configure it in Django Admin under **Stations > SIM alert settings**:

- whether it is enabled (on by default)
- who receives it: Admins, All active users, or Selected users (the same options as the daily report)
- the warning days, e.g. `7,3,1`

Add an hourly cPanel cron job, using the same virtual-environment Python as the daily report:

```sh
0 * * * * /home/CPANEL_USER/virtualenv/aws_backend/3.14/bin/python /home/CPANEL_USER/aws_backend/manage.py send_sim_alerts >> /home/CPANEL_USER/aws_backend/sim_alerts_cron.log 2>&1
```

Run it with `--dry-run` first. That lists the warnings and recipients without sending anything.
The email links to `FRONTEND_URL` + `/dashboard/sim-management`, so set `FRONTEND_URL` in production.

Things the estimate does not see: traffic the modem sends to anything other than this
server (NTP, firmware updates), and retries that never reach the server. Calibration
absorbs these into the factor.
