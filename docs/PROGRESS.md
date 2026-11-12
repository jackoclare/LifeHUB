# MyLife Hub — progress tracker

## Setup facts

| Thing | Value |
|---|---|
| GitHub repo | `jackoclare/LifeHUB` |
| Supabase project | Jack's Project — ref `peaxepkkuvdemrnrnfwa`, region eu-central-1 (Frankfurt) |
| Supabase org | Permanent Recruitment Solutions (moved there so Claude can reach it). Kept fully separate from the PRS CRM project. |
| Hosting | Vercel (free Hobby plan), project `life-hub` |
| Live address | https://life-hub-nine-rouge.vercel.app |
| Stack | Next.js 16 + TypeScript + Tailwind CSS 4 + Supabase; SwiftUI companion for HealthKit in Phase 5 |

## Phase 1 — Foundations ✅ complete and live (12 Nov 2026)

- [x] Inspected GitHub: only the two PRS CRM repos, left untouched
- [x] Inspected Supabase: Jack's Project is empty (no tables, migrations or security warnings)
- [x] Project structure, config, security headers
- [x] Design system: dark theme (default) + light theme, section colours, cards, buttons, 44px tap targets, iPhone safe areas
- [x] Navigation: bottom tab bar on iPhone (Home, Calendar, Bills, Sport, More), sidebar on desktop
- [x] Customisable dashboard: show/hide/reorder 12 cards, saved on the device
- [x] **Calendar** (added at Jack's request): month view, add/delete personal events and reminders; colour-coded for bills, football, travel
- [x] Placeholder pages for every later section, which show no fake data
- [x] Installable PWA: manifest + app icons
- [x] Supabase client code ready for Phase 2
- [x] Code pushed to GitHub (LifeHUB)
- [x] Deployed to Vercel (first build passed); dashboard and calendar tested on desktop
- [ ] Add to iPhone Home Screen and check on the phone ← Jack

## Phase 2 — Personal management ✅ live (12 Nov 2026)

- [x] Polish: animated background, hero with live clock, staggered cards, hover glow, sliding tab bar
- [x] Dashboard redesign: live cards (Coming up, Bills, Reminders) on top, "Coming soon" tiles below
- [x] Supabase: Site URL + redirect set to the live address
- [x] Tables + Row Level Security: user_settings, calendar_events, bills (+ account_ref, website), bill_payments, shopping_lists, shopping_items, wishlist_items, wishlist_prices. Security advisor: no issues
- [x] Sign-in: email + password (works inside the iPhone Home Screen app)
- [x] Calendar synced to Supabase; device-only events moved in on first sign-in; bill due dates shown automatically
- [x] Bills: add/edit/delete, 8 frequencies, mark paid / undo, overdue, totals, sortable spreadsheet, 12-month + category charts, company logos
- [x] Shopping lists: multiple lists, aisle auto-sorting, big tick buttons, quantities, prices, running total, "often bought"
- [x] Wish list: priority, price vs target, price history sparkline, links, images, bought filter
- [x] Jack created his account; 8 bills imported from his bills sheet (IWNL paused: no amount/day on the sheet)
- [x] PIN unlock: per-person PIN (bcrypt), server-checked, lock-out after 5 wrong tries; set in Settings
- [ ] Jack pastes SUPABASE_SECRET_KEY into Vercel (needed for PIN unlock), then redeploy
- [x] Live news: BBC RSS (top, UK, football, sport) — scrolling ticker, rotating headline cards, /news page
- Sign-ups stay open: Jack may add accounts for other people later (each sees only their own data)

## Later phases

- **Phase 3:** deals, travel, fuel, explore, weather; automatic wish-list price tracking
- **Phase 4:** football (Aston Villa + England fixtures auto-added to the calendar), news, TV guide
- **Phase 5:** iOS companion app (HealthKit), food diary, meal-photo estimates
- **Phase 6:** notifications, price alerts, final testing

## Decisions log

- 12 Nov: Calendar added to Phase 1 as a core section. Bills (Phase 2) and favourite-team fixtures (Phase 4) will feed into it automatically.
- 12 Nov: Vercel account is the free Hobby plan (its name is "Permanent Recruitment Solutions" but it is personal). No paid plans needed.
- 12 Nov: Jack chose a PIN instead of email/password for everyday unlocking.
- 12 Nov: Until sign-in exists, dashboard layout and calendar events are stored on each device only.
