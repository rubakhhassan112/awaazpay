# AwaazPay — Voice-First Payment Accessibility Prototype

Hackathon MVP: **React (Vite + Tailwind) frontend** + **Django REST Framework backend**.

Full flow from the PRD: always-listening voice interaction → simulated NFC terminal
detection → merchant/amount announcement → secret-word + random-number security
challenge → explicit "Confirm Payment" → simulated wallet update → audio receipt →
voice balance/history queries → simulate receiving money. Large touch-button
fallbacks and live captions are available everywhere for when voice isn't reliable.

This is a prototype: no real money moves, no real bank or NFC hardware is used,
and the security challenge is **not** bank-grade or biometric authentication.

## Project layout

```
awaazpay/
  backend/    Django + Django REST Framework API (SQLite, simulated wallet/transactions)
  frontend/   React + Vite + Tailwind CSS voice UI (Web Speech API)
```

## Running the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate        # creates db.sqlite3 and seeds demo data
python manage.py runserver      # http://localhost:8000
```

This seeds:
- a demo wallet with a starting balance of **PKR 25,000** and secret word **"falcon"**
- three demo merchant terminals: ABC Grocery Store (PKR 2,500), Karachi Coffee House
  (PKR 750), City Pharmacy (PKR 1,200)

Optional: `python manage.py createsuperuser` then visit `/admin/` to edit the wallet,
merchants, or which terminal is the active demo terminal.

## Running the frontend

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

The frontend expects the API at `http://localhost:8000/api` (see `frontend/.env`,
`VITE_API_URL`). Update that if your backend runs elsewhere.

**Voice recognition requires Google Chrome (desktop or Android)** — it's the browser
with reliable Web Speech API support. Other browsers fall back to the large on-screen
buttons. The mic also requires HTTPS or `localhost` — it will not work over a plain
`http://<lan-ip>` address.

## Trying the demo flow

1. Open the app, tap **"Tap to Start AwaazPay"**, and allow microphone access.
2. First run: say or type a secret word (e.g. "falcon").
3. Say **"Pay using NFC"**. AwaazPay announces terminal detection, the merchant name,
   and the amount.
4. When asked, say your secret word plus the two-digit number it reads out
   (e.g. "falcon forty two").
5. Say **"Confirm Payment"** to complete the transaction and hear the audio receipt.
6. Try **"What is my balance?"**, **"What was my last transaction?"**,
   **"Tell me my recent transactions"**, and **"Receive money"** from the home screen.
7. You can say **"Cancel"** at almost any point during a payment to stop it safely.

Use the **Demo settings** link at the bottom of the home screen to choose which of
the three merchant terminals gets "detected" on the next NFC payment.

## Deploying to Render

The repo includes a `render.yaml` Blueprint that provisions all three pieces in one
go: the Django API as a web service, a free Postgres database, and the React app
as a static site.

1. Push this project to a GitHub (or GitLab) repository.
2. In the Render Dashboard, click **New** → **Blueprint**, and connect that repo.
   Render will read `render.yaml` from the repo root and show you the three
   resources it's about to create (`awaazpay-backend`, `awaazpay-db`,
   `awaazpay-frontend`) — click **Apply**.
3. Wait for `awaazpay-backend` to finish deploying first (it runs `build.sh`,
   which installs dependencies, collects static files, and runs migrations —
   including seeding the demo wallet and merchants). Then `awaazpay-frontend`
   will build against it.
4. Once both show **Live**, open the frontend's `https://awaazpay-frontend.onrender.com`
   URL — that's your deployed AwaazPay.

**Why Postgres instead of SQLite in production:** Render's free web services have
an ephemeral filesystem, so a SQLite file would get wiped on every redeploy or
restart. The blueprint switches the backend to Postgres automatically via the
`DATABASE_URL` environment variable; locally, nothing changes and it still uses
SQLite by default.

**If your Render service names end up different** from `awaazpay-backend` /
`awaazpay-frontend` (Render appends a suffix if the name is taken), update the
`VITE_API_URL` value in `render.yaml` under the frontend service to match your
actual backend URL, then trigger a manual redeploy of the frontend so the new
value gets baked into the build (Vite env vars are build-time only).

**Prefer clicking through the dashboard instead of a Blueprint?**
- Backend: **New → Web Service**, root directory `backend`, environment
  "Python 3", build command `./build.sh`, start command
  `gunicorn config.wsgi:application`. Add a free Postgres database
  (**New → PostgreSQL**) and copy its "Internal Database URL" into the
  backend's `DATABASE_URL` environment variable, plus set `DEBUG=False`
  and a random `SECRET_KEY`.
- Frontend: **New → Static Site**, root directory `frontend`, build command
  `npm ci && npm run build`, publish directory `dist`, and an environment
  variable `VITE_API_URL` set to `https://<your-backend-name>.onrender.com/api`.

**Note on voice:** the Web Speech API requires HTTPS or `localhost` — Render
serves everything over HTTPS by default, so the always-listening mic and
speech output will work on the deployed site exactly as they do locally.
