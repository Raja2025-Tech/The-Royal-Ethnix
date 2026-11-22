# The Royal Ethnix – Tailor Management System (TMS)

A web app for running a custom-tailoring shop: bills and payments, garments with measurements,
karigar assignment and wages, CAD desk, karigar handover, daily cashbook, stock, alerts, reports
and 80 mm thermal printing (Retsol RTP-82UE).

Built with React + Vite + Tailwind. Data and logins use **Firebase** (free Spark plan is enough).
No other platform or paid service is needed.

---

## Features

- **Orders by bill number**: type `1061` and it becomes `AT/1061/2627` (financial year is added
  automatically). Cash / card / UPI split, discount, dues.
- **Garments**: Top wear, bottom wear and accessories, full measurement sets, sleeve type,
  handwork stage, fabric quantity in meter or cm, item and fabric photos, copy measurements from
  the customer's previous garment.
- **Karigars**: up to 3 karigars per garment with separate wages, karigar login with own
  dashboard (stages, rate, notes, payments), majuri payments, wage statements, performance report.
- **Production**: 11-stage pipeline, work queue, CAD desk (item-wise), fabric handover and
  receipt, alerts for late garments, WhatsApp reminders (click to send).
- **Money**: Daily cashbook (order cash is added automatically), opening and closing balance,
  dues and collections, reports.
- **Stock**: items, in / out, shop ↔ factory movements.
- **Change history** for every add, edit and delete.
- **Printing** on 80 mm paper: job card, labels with barcode, delivery challan, karigar
  statement, cashbook closing.
- **Roles**: Admin (owner), Manager, Counter Staff, CAD Master, Karigar – each sees only what
  it should. Counter staff never see karigar wages or karigar payments.

---

## 1. Run it on your computer

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173).

Without Firebase settings the app starts in **demo mode**: data is saved only in that browser,
and these logins work (password `demo1234` for all):

| Role | Email |
| --- | --- |
| Admin | owner@demo.app |
| Manager | manager@demo.app |
| Counter Staff | staff@demo.app |
| CAD Master | cad@demo.app |
| Karigar | karigar@demo.app |

Demo mode is for trying the app. For real use, connect Firebase so every phone and computer
shares the same data.

---

## 2. Connect Firebase (shared data and real logins)

1. Go to <https://console.firebase.google.com> → **Add project** (Google Analytics not needed).
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** → choose a location near you
   (for India: `asia-south1` Mumbai) → start in **production mode**.
4. **Firestore → Rules**: replace everything with the contents of `firestore.rules` from this
   repo and press **Publish**. (Or use the Firebase CLI: `firebase deploy --only firestore:rules`.)
5. **Project settings (gear) → General → Your apps → Web (`</>`)** → register an app → copy the
   `firebaseConfig` values.
6. Copy `.env.example` to `.env` and fill in the values:

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

7. `npm run dev` again. The sign-in page now shows **Create the owner account** – this happens
   only once. That account is the Admin. The standard garment categories are added for you.
8. As Admin, open **Team → Add member** to create logins for staff, manager, CAD master and
   karigars. For a karigar, also open **Karigars**, edit the karigar and set **Login account**
   to that person's login, so they see their own garments and payments.

The Firebase web config is not a secret (it is visible in every web app). Your data is protected
by the login and by `firestore.rules`.

---

## 3. Put it online

### Option A – GitHub Pages (free, automatic)

1. Push this project to a GitHub repository (branch `main`).
2. Repository **Settings → Secrets and variables → Actions → New repository secret**: add the six
   `VITE_FIREBASE_...` values from your `.env`.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push to `main` (or run the workflow from the **Actions** tab). The site appears at
   `https://<your-user>.github.io/<repo-name>/`.
5. In Firebase **Authentication → Settings → Authorized domains**, add `<your-user>.github.io`.

### Option B – Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # choose your project
npm run build
firebase deploy               # publishes the site and the Firestore rules
```

### Option C – Netlify / Vercel

Build command `npm run build`, output folder `dist`, and add the six `VITE_FIREBASE_...`
environment variables in the site settings.

The app uses hash links (`/#/orders`), so it works on any static host without extra setup.

---

## 4. Printing on the Retsol RTP-82UE (80 mm)

- Set the Retsol as the **default printer** in Windows.
- Every print opens Chrome's print preview already sized for 80 mm paper; press **Print**.
- To print without the preview, start Chrome with `--kiosk-printing`
  (shortcut → Properties → Target → add ` --kiosk-printing` at the end).

---

## 5. Good to know

- **Photos** are compressed (max 1280 px JPEG) and stored inside the garment record, so no paid
  Firebase Storage is needed. One garment can hold roughly 6–8 photos in total.
- **Offline**: with Firebase the app keeps working for a short internet drop; changes sync when
  the connection returns.
- **WhatsApp** reminders open WhatsApp with the message filled in; staff press Send. Sending
  automatically through a WhatsApp Business API (for example AiSensy) needs a small server
  function with the secret API key; it is not included.
- **Free plan limits** (Spark): 50,000 document reads and 20,000 writes per day, 1 GiB storage –
  plenty for one shop. Every user loads the records their role may see when they open a page.
- **Password reset**: Admin can send a reset email from **Team**, and anyone can use
  **Forgot password?** on the sign-in page.

---

## Project structure

```
src/
  pages/            every screen (a file with `export const route` becomes a page)
  components/       shared UI (forms, pickers, layout)
  lib/tms.js        business rules: stages, bill number, karigar wages, cashbook sync
  lib/statement.js  80 mm print layouts and barcodes
  lib/audit.js      automatic change history
  services/
    sdk.js          data layer: queries, permissions, photos, sessions
    query.js        filters (eq, and, or, contains ...)
    backend/        firebase.js (real) and local.js (demo mode)
    data/*.json     table definitions and starter data (garment categories)
    userPermissions.js  what each role can read / add / edit / delete
    policies/       record-level rules (karigar sees own garments, staff never see karigar cash)
firestore.rules     the same rules enforced on the Firebase server
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | start for development |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the production build locally |

## License

Private project for The Royal Ethnix.
