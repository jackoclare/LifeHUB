# MyLife Hub

Jack's personal all-in-one app, built for iPhone first and also usable on a computer.

- **Brief:** [`docs/BRIEF.md`](docs/BRIEF.md)
- **Progress:** [`docs/PROGRESS.md`](docs/PROGRESS.md)

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Row Level Security) · Vercel hosting · SwiftUI + HealthKit companion app (Phase 5)

## Getting it online (one-time setup)

1. **Vercel:** go to [vercel.com](https://vercel.com), choose **Sign up → Continue with GitHub**, and use the free Hobby plan.
2. Choose **Add New → Project**, pick the `LifeHUB` repo, then select **Import**.
3. Before deploying, open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://peaxepkkuvdemrnrnfwa.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the publishable key from Supabase → Project Settings → API Keys (it starts `sb_publishable_`)
4. Select **Deploy**. After about a minute you'll get a link such as `mylife-hub.vercel.app`.
5. On your iPhone, open that link in **Safari**, tap **Share**, then **Add to Home Screen**.

From then on, every change pushed to GitHub redeploys automatically.

## Running it on a computer (optional)

```bash
npm install
cp .env.example .env.local   # then fill in the publishable key
npm run dev                  # open http://localhost:3000
```

## Folder guide

```
src/app/            pages (one folder per section)
src/components/     shared UI: app shell, dashboard, headers
src/lib/            navigation, dashboard settings, calendar, Supabase clients
public/icons/       app icons (regenerate with scripts/make-icons.mjs)
docs/               brief and progress tracker
```

## Security rules

- Only `NEXT_PUBLIC_*` values reach the browser, and those are safe to share.
- Secret keys (Supabase secret key, paid API keys) go **only** in Vercel environment variables, never in code or chat.
- Every database table has Row Level Security, so each user can only ever see their own rows.
