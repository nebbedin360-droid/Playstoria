# Playstoria

The community store for apps, games and software made by Ethiopian developers.
Users can browse, search, download, rate and report projects; developers can publish free or paid projects and request payouts; admins moderate everything from the in-app dashboard.

## Run locally

Requires Node.js 22 and npm.

```bash
npm install
cp .env.example .env     # then edit the values
npm start
```

Open http://localhost:3000. Change the admin credentials and session secret in `.env` before exposing the app to anyone. `data/` and `uploads/` are created automatically.

## Deploy on Render

- **Build command:** `npm install`  ·  **Start command:** `npm start`  ·  **Node:** 22.x
- Required environment variables in production: `NODE_ENV=production`, `APP_URL` (your public HTTPS URL, no trailing slash), `SESSION_SECRET` (32+ random characters), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- Attach a persistent disk at `/var/data` and set `DATA_DIR=/var/data/data` and `UPLOAD_DIR=/var/data/uploads`, otherwise accounts and uploads are lost on redeploy.
- Optional: SMTP variables (email verification and admin upload alerts), Google OAuth variables, and `TELEBIRR_NUMBER` for paid apps. See `.env.example`.

> The database file keeps its original name (`nebbedin-store.db`) on purpose, so existing accounts and projects keep working after the rename to Playstoria.

## Project structure

```
server.js          Express API, SEO page rendering, sitemap, robots
views/index.html   Page template (SEO tags are filled in per page by the server)
public/            styles.css, app.js, terms.html, privacy.html, icons, logo, og-image.png
```

## SEO and Google logo checklist

Playstoria ships with: title/description/keywords, canonical URLs, Open Graph + Twitter cards, JSON-LD (Organization with logo, WebSite, FAQPage, and a SoftwareApplication page for every published project at `/app/ID`), a dynamic `sitemap.xml` and `robots.txt`, a web manifest and a full icon set (`favicon.ico` 48px, SVG, 192/512 PNG, Apple touch icon).

To get the logo to show in Google Search results:

1. Make sure `APP_URL` is your final public domain, then open `https://YOUR-DOMAIN/favicon.ico` and `/icon-192.png` to confirm they load.
2. Add the site in **Google Search Console** and verify ownership.
3. Submit `https://YOUR-DOMAIN/sitemap.xml` and use **URL Inspection → Request indexing** on the home page.
4. Google refreshes favicons on its own schedule; it can take several days to a few weeks.

A custom domain (for example `playstoria.com`) ranks and shows its icon more reliably than a free `onrender.com` subdomain.

## Features

- Public browsing, live search, filters, shareable project pages, ratings and reviews
- Email/password accounts, optional Google sign-in and email verification
- Developer dashboard: upload with progress bar, cover images, free or paid pricing, delete own projects, earnings and withdrawal requests
- Admin tools: review/download pending uploads, approve or reject, handle reports, verify Telebirr payments, record payouts
- Manual Telebirr purchases: buyer submits reference + screenshot, admin verifies, developer receives 90% and Playstoria 10%

## Before real users arrive

APKs and executables can be harmful and this app does not scan for malware. Test on a staging deployment, review every upload by hand, keep backups of the database and uploads, and have the Terms and Privacy pages reviewed for your local requirements. The Telebirr flow is manual: it never talks to Telebirr automatically and cannot verify screenshots by itself.
