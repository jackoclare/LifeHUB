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
- [x] SUPABASE_SECRET_KEY added in Vercel and redeployed → PIN unlock live (Jack sets his PIN in Settings)
- [x] Live news: BBC RSS (top, UK, football, sport) — scrolling ticker, rotating headline cards, /news page
- Sign-ups stay open: Jack may add accounts for other people later (each sees only their own data)

## Phase 3/4 — started (12 Nov 2026)

- [x] Crisper design: Inter / Inter Tight, deeper neutrals, near-solid cards, solid gradient icon tiles, calmer background
- [x] Weather: Open-Meteo (free, no key) — dashboard card with hourly strip, /weather page with 7-day forecast, animated icons; location by postcode/town/device
- [x] Football: TheSportsDB free key — Aston Villa (133601) & England (133914): next match countdown, recent form, results; fixtures on dashboard + calendar. Free tier only returns next 1 + last 1 match per team
- [x] News: BBC RSS ticker + rotating cards + /news page
- [~] Explore map: Leaflet + OpenStreetMap/Overpass, saved places table. Overpass servers are rejecting/timing out from Vercel (406 / timeouts) — needs a fix or a keyed provider (e.g. Geoapify free tier)
- [x] Fuel: live. Fuel Finder credentials saved as Edge Function secrets, but Fuel Finder's CloudFront firewall returns 403 to cloud servers (Supabase Frankfurt + London, Vercel US) before auth — not worked around. `fuel-sync` falls back to retailers' open JSON feeds (Asda, Esso/Tesco Alliance, SGN, JET, Moto; Tesco/Rontec stale, bp/MFG 403) → ~1,150 stations, hourly via pg_cron job `mylife-fuel-sync` (:07). Switches to full Fuel Finder data automatically if access opens. Next step: ask the Fuel Finder team about server access
- [x] Map hub (/map): one big map with layers — fuel prices (load for the area on screen), holidays abroad, saved places; sat-nav "follow me" (live GPS + heading arrow) on Map, Fuel and Explore
- [x] Map tiles switched to OpenStreetMap (CARTO started requiring an API key); dark mode via CSS filter
- [x] PIN unlock moved to Supabase Edge Function `unlock` (uses built-in service-role key) — Vercel SUPABASE_SECRET_KEY no longer needed
- [x] Assistant: Safari speech fix (uses heard text when no final result), clear mic error messages, iOS speech unlock
- [x] Tap whole match panels (dashboard, calendar, coming-up) to open lineups
- [x] New JC app icon + sidebar logo
- [x] Travel: destinations, UK airports, Skyscanner / Google Flights / Booking.com search links, saved destinations (no paid provider)
- [ ] Deals: needs a provider
- [x] Calendar feed: Edge Function `calendar` serves an iCal (webcal) feed of events, bills and fixtures — subscribe on iPhone
- [x] Voice assistant: floating button, speech in/out (en-GB), adds shopping/wish-list items and calendar events, opens pages, answers weather/next match/bills due (on-device parsing, no paid AI)
- [x] Build fix: tsconfig excludes supabase/ (Deno functions broke Vercel type-check)
- [x] Match pages (/sport/match/[id]): scoreboard, countdown, venue, lineups. API-Football (free: only yesterday→tomorrow) gives full XIs/subs/formation on match day; TheSportsDB partial fallback
- [x] Sport tabs: Football (Villa, England, PL table top-5), F1 (4370), Darts (PDC 4554)
- [x] Explore: Geoapify provider wired (falls back to Overpass) — GEOAPIFY_KEY in Vercel is the masked 10-char value; needs the real key
- [x] /api/health shows which server keys are set/working (never values)
- [x] Notifications: service worker + Settings → Notifications (turn on, per-type toggles, test). Supabase Edge Function `notify` (bill reminders day-before/on-day/overdue 8am–9pm; kick-off alerts ~1h before Villa/England) runs every 15 min via pg_cron. VAPID secrets set ✅ (configured: true)
- [x] PIN unlock no longer depends on SUPABASE_SECRET_KEY in Vercel
- Note: unused function public.get_push_config() left in DB (harmless, service-role only)
- Optional upgrades: football-data.org free key (league tables, more fixtures); THESPORTSDB_KEY premium ($9/mo) for full fixture lists

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
