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

## Phase 2 — Personal management (next)

- Sign-in (Supabase Auth, email magic link)
- Tables + Row Level Security: profiles, calendar_events, bills, bill_payments, shopping_lists, shopping_items, wishlist_items
- Move calendar events from the device into Supabase
- Bills manager → due dates appear on the calendar automatically
- Shopping lists, wish list

## Later phases

- **Phase 3:** deals, travel, fuel, explore, weather
- **Phase 4:** football (Aston Villa + England fixtures auto-added to the calendar), news, TV guide
- **Phase 5:** iOS companion app (HealthKit), food diary, meal-photo estimates
- **Phase 6:** notifications, price alerts, final testing

## Decisions log

- 12 Nov: Calendar added to Phase 1 as a core section. Bills (Phase 2) and favourite-team fixtures (Phase 4) will feed into it automatically.
- 12 Nov: Vercel account is the free Hobby plan (its name is "Permanent Recruitment Solutions" but it is personal). No paid plans needed.
- 12 Nov: Until sign-in exists, dashboard layout and calendar events are stored on each device only.
