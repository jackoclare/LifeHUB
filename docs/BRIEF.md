MYLIFE HUB — MASTER DEVELOPMENT BRIEF

Your role

Act as my senior full-stack developer, software architect, UI/UX designer and technical project manager.

I want you to help me build a fully working personal application called MyLife Hub.

This is a long-term project. I want a polished, reliable application that I will use regularly on my iPhone and can also access on my computer.

I am not an experienced developer, so explain technical steps clearly and guide me through the process.

My existing setup

I already have:

* GitHub account.
* A new Supabase project called “Jack’s project”.
* Claude AI set up to help develop the project.

Before doing anything, inspect the existing repository and Supabase configuration. Do not delete, overwrite or change existing data without asking me.

Keep this project separate from any workplace CRM or business systems.

1. Design and user experience

Build an iPhone-first responsive application that also works exceptionally well on desktop.

I want:

* A premium, modern dashboard.
* A dark theme with an optional light theme.
* Simple navigation.
* Smooth transitions.
* Clear icons and visual sections.
* Fast loading.
* Mobile-friendly buttons and controls.
* An installable PWA where appropriate.
* A consistent design throughout the application.

It must feel like a professionally designed application, not a generic template.

2. Main dashboard

Create a customisable home dashboard showing:

* Today’s weather and useful daily information.
* Latest news.
* Latest sports headlines.
* Football fixtures and live scores.
* Upcoming bills.
* Daily steps and activity.
* Calorie and nutrition overview.
* Latest travel deals.
* Best shopping discounts.
* Local offers and activities.
* Personal reminders.

Allow me to customise the dashboard and choose which sections appear.

3. Travel finder

Build an interactive world map where I can select destinations and compare:

* Cheapest flights.
* Cheapest holiday packages.
* Return and one-way flights.
* Departure airports.
* Flexible travel dates.
* Different trip durations.
* Hotel options.
* Prices and booking links.
* Saved destinations.
* Flight and holiday price alerts.

Initially prioritise European destinations including Spain, France, Italy, Greece and Portugal, but design it to support worldwide travel.

Show the ten cheapest available options where the provider supplies sufficient results. Never invent prices or availability.

4. UK fuel finder

Build an interactive UK map showing petrol stations and fuel prices.

Include:

* Unleaded petrol.
* Diesel.
* Premium fuels where available.
* Cheapest nearby stations.
* Nearest stations.
* Search by postcode or town.
* Station details.
* Distance.
* Last-updated timestamps.

Use legitimate fuel-price data providers and clearly identify data limitations.

5. Restaurants and activities

Create a UK discovery map covering:

* Restaurants.
* Pubs.
* Cafes.
* Attractions.
* Days out.
* Activities.
* Events.
* Entertainment.

Include:

* Search by location.
* Ratings and reviews where available.
* Opening hours.
* Price filters.
* Categories.
* Directions.
* Special offers.
* Discounts.
* Saved places.

6. Bills and finances

Build a personal bill management system.

I need to:

* Add and edit bills.
* Record the provider and amount.
* Set payment dates.
* Choose weekly, monthly, annual or other recurring frequencies.
* Mark bills as paid.
* See overdue bills.
* Receive upcoming payment reminders.
* View monthly and annual spending.
* See totals and spending charts.

Include a spreadsheet-style overview that is easy to use on a phone.

Do not connect to banking accounts without my explicit permission.

7. Sports centre

Build a sports section focused initially on football.

Cover:

* Premier League.
* Championship.
* League One.
* League Two.
* National League.
* La Liga.
* Bundesliga.
* Serie A.
* Ligue 1.
* International football.
* Major tournaments.

Features:

* Live scores.
* Fixtures.
* Results.
* League tables.
* Match information.
* Team pages.
* Match statistics where available.
* Favourite teams.
* Favourite competitions.
* Latest sports news.

Use genuine sports data APIs and respect their licensing and rate limits.

8. TV guide

Build a UK television guide with:

* Current programmes.
* Upcoming programmes.
* Channel listings.
* Sky and Sky Sports channels.
* Major UK broadcasters.
* Programme descriptions.
* Start and finish times.
* Search by channel or programme.
* Favourite channels.
* What’s on tonight.

Use a legitimate TV listings provider. Do not provide unauthorised television streams.

9. Food shopping list

Build a simple shopping list designed for use while walking around a supermarket.

Include:

* Add and remove items.
* Tick items off.
* Edit quantities.
* Add estimated prices.
* Categories.
* Multiple shopping lists.
* Frequently purchased items.
* Estimated shopping total.

10. Personal wish list

Allow me to save products I want to buy.

Examples:

* PlayStation 5.
* Furniture.
* Electronics.
* Clothing.
* Household products.

Each item should support:

* Product image.
* Name.
* Retailer.
* Current price.
* Target price.
* Product link.
* Priority.
* Notes.
* Price history where available.
* Price-drop alerts.

11. Deals and offers

Build a dedicated deals hub.

Categories:

Fashion: Nike, Adidas, ASOS, Zara, H&M, JD Sports, Next and other retailers.

Technology: Currys, Argos, Amazon, PlayStation, Samsung and other electronics retailers.

Home: IKEA, Dunelm, B&Q, Wayfair and furniture retailers.

Food: Tesco, Asda, Aldi, Sainsbury’s and other supermarkets.

Features:

* Best deals today.
* Discount codes.
* Clearance offers.
* Original and current prices.
* Percentage savings.
* Offer expiry dates.
* Retailer filters.
* Saved deals.
* Direct shopping links.
* Wish list matching.
* Alerts when saved products become cheaper.

Only show verified deals. Clearly identify when prices or offers were last checked.

12. Health and fitness centre

I use an iPhone and Apple Watch.

I want to connect Apple Health and build a personal health and fitness dashboard.

Important: a standard website cannot directly read Apple Health data. Design this with a responsive web application and a native iOS companion using Swift and HealthKit.

Include:

Activity

* Steps.
* Walking distance.
* Active calories.
* Workouts.
* Exercise history.
* Daily goals.
* Weekly activity overview.

Nutrition

* Daily calories.
* Protein.
* Carbohydrates.
* Fat.
* Fibre.
* Food diary.
* Daily and weekly totals.
* Water tracking.
* Optional weight tracking.

Food logging

* Photograph meals.
* Type meals manually.
* Search foods.
* Scan barcodes where supported.
* Record breakfast, lunch, dinner and snacks.

For meal photographs, use AI to identify likely ingredients and estimate portions and nutritional values. Let me correct the ingredients and quantities before saving.

Clearly label estimates as estimates.

Protect health data with strict permissions and access controls. Only collect information I explicitly allow.

13. Notifications

Create a central notification system for:

* Bills.
* Overdue payments.
* Flight price drops.
* Holiday deals.
* Shopping discounts.
* Wish list price changes.
* Favourite football teams.
* Upcoming matches.
* Fitness goals.

Allow me to control notification preferences.

Support iPhone notifications and browser notifications where technically possible.

14. Database and security

Use my existing Supabase project, “Jack’s project”.

Use:

* PostgreSQL.
* Supabase Authentication.
* Row Level Security.
* Supabase Storage where appropriate.
* Secure database policies.
* Database migrations.
* Environment variables.

Every user’s personal information must be isolated to their own account.

Never expose service role keys, passwords or private API credentials in frontend code.

Do not make destructive database changes without my approval.

15. Technology

Recommend and use a suitable modern stack.

Consider:

* TypeScript.
* React.
* Next.js.
* Tailwind CSS.
* Supabase.
* GitHub.
* Swift and SwiftUI for the native iOS HealthKit component.

Choose the architecture that gives the best balance of reliability, mobile performance and long-term maintainability.

Use secure server-side API integrations wherever possible.

16. External APIs and costs

Research suitable providers for:

* Flights and holidays.
* Maps.
* UK fuel prices.
* Restaurants and attractions.
* Shopping prices and deals.
* Football scores and sports news.
* TV listings.
* Food nutrition.
* AI food recognition.

For every provider, explain:

* What it offers.
* Whether a free tier exists.
* Its pricing.
* API restrictions.
* How to configure it.
* Possible alternatives.

Do not start paid subscriptions or integrations without asking me first.

Do not claim that a feature is live until it has been configured and tested.

17. Development phases

Build the application in manageable stages.

Phase 1 — Foundations

* Inspect GitHub repository.
* Inspect Supabase project.
* Recommend architecture.
* Set up project structure.
* Establish design system.
* Create navigation.
* Build dashboard.
* Make the application responsive.

Phase 2 — Personal management

* Authentication.
* Database tables and security.
* Bills manager.
* Shopping lists.
* Wish list.

Phase 3 — Discovery and shopping

* Deals hub.
* Travel finder.
* Fuel finder.
* Restaurants and activities map.

Phase 4 — Sports and entertainment

* Football news.
* Live scores.
* Fixtures.
* League tables.
* TV guide.

Phase 5 — Health and fitness

* Native iOS companion.
* HealthKit permissions.
* Apple Watch activity synchronisation.
* Food diary.
* Meal photo analysis.
* Nutrition dashboard.

Phase 6 — Notifications and testing

* Notifications.
* Price alerts.
* Final mobile optimisation.
* Desktop testing.
* Security checks.
* Deployment preparation.

18. How to work with me

I want to build this together, one stage at a time.

I need you to:

1. Explain what you are doing.
2. Tell me which files you are creating or changing.
3. Give me commands I can copy and paste.
4. Explain any Supabase or GitHub setup required.
5. Explain costs before recommending paid services.
6. Test each stage.
7. Keep track of completed work.
8. Avoid unnecessary complexity.
9. Never silently remove existing functionality.
10. Ask me before making significant architectural or destructive changes.

I am happy to follow instructions, but make them clear and manageable.

YOUR FIRST TASK

Start with Phase 1.

First inspect my existing GitHub repository and Supabase project.

Then:

* Explain what you found.
* Recommend the architecture.
* Identify anything I need to configure.
* Set out the first development steps.
* Begin creating the foundations once the existing setup is understood.

Do not attempt to build every module at once.

Do not invent integrations, credentials or data.

Do not make paid purchases or destructive changes without asking me.

The ultimate goal is a premium, reliable, all-in-one personal application that I can use every day on my iPhone and access on my computer.