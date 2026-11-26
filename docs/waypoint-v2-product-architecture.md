# WAYPOINT v2 — Product and Experience Architecture

## Product direction

Rebuild the application as a single travel workspace, not a collection of disconnected utilities. The trip is the primary object. Every itinerary stop, route, note, expense, reservation, and preparation task belongs to a trip and can be reached from that trip.

This is a functional rebuild. Do not treat a new color palette or a CSS overlay as completion.

## Reference patterns

- [Wanderlog](https://wanderlog.com/): itinerary and map in one view, day-by-day plans, route optimization, expenses, checklists, and trip collaboration.
- [TripIt](https://www.tripit.com/web/free): a unified itinerary assembled from booking confirmations, with travel documents and flight information.
- [Trip.com / TripGenie](https://www.trip.com/newsroom/tripgenie-new-features-2/): AI planning connected to booked flights, hotels, places, and travel notes.
- [Google Maps](https://support.google.com/maps/answer/144349): discovery, saved places, map context, and navigation.
- [Facebook / Meta Design](https://www.meta.com/design-at-meta/blog/redefining-facebooks-brand-identity/): coherent typography, color, iconography, and reusable interaction patterns.
- [Instagram Lite](https://www.meta.com/design-at-meta/blog/instagram-lite-a-global-collaboration-between-research-and-design/): explicit controls, clear feedback, responsive behavior, and performance-conscious interactions.
- [YouTube UX principles](https://blog.youtube/inside-youtube/design-principles-use-put-creators-center-stage/): content-first hierarchy, ruthless relevance, fewer redundant actions, and consistency across devices.

The goal is not to copy proprietary screens or assets. Use the interaction principles that make these products understandable and reliable.

## Information architecture

### Global navigation
- Home: upcoming trips, recent work, deadlines, and a clear create-trip action.
- Trips: searchable trip library with status and dates.
- Saved places: discoveries that have not yet been assigned to a day.
- Account and settings: identity, sync, data export, and integrations.

### Trip workspace
A trip opens into one persistent workspace with a trip header and these sections:
1. Overview — destination, dates, travelers, reservations summary, budget health, and preparation progress.
2. Plan — daily timeline and real interactive map together. Day switching must preserve the map context.
3. Discover — actual places with source, address, rating, hours when available, and one-step save/add actions.
4. Reservations — flights, hotels, trains, buses, rental cars, and activities; manual entry plus ticket/confirmation document extraction.
5. Budget — planned and actual amounts, itemized expenses, linked stop/reservation, original currency, KRW conversion snapshot, category breakdown, and settlement.
6. Preparation — checklist generated from destination, dates, travel mode, traveler count, and reservation state; user can edit every item.
7. Notes — trip-level and stop-level notes, searchable and timestamped.

## Core workflows

### Plan a trip
1. Enter destination (optional), dates, travelers, budget, travel style, and transport constraints.
2. AI returns a draft with a clear explanation of assumptions and candidate places.
3. Verify places through Places API; do not silently treat a text suggestion as a confirmed business.
4. Let the user accept, remove, replace, or move each stop.
5. Generate route legs from the actual selected stop order and travel mode.
6. Recalculate only affected legs after a stop is moved or edited.

### Itinerary and map
- Use a real interactive map with pins for the day's confirmed places.
- Use the route geometry returned by a routing provider; never draw a guessed route.
- Each stop supports time, duration, note, estimated cost, category, address, coordinates, and source.
- Drag-and-drop ordering must persist and trigger route recalculation.
- A stop can be linked to an expense, reservation, and notes.
- On mobile, switch between timeline and map without losing selection.

### Reservations and ticket import
- Allow manual flight/hotel/transport/activity records.
- Accept PDF or image confirmation documents and extract candidate fields with AI.
- Show a review/confirmation step before saving extracted data.
- Preserve the original uploaded document privately.
- Live flight status is a separate integration and must show its data provider and last updated time. Never imply that parsing a ticket is the same as live status tracking.

### Budget and exchange rates
- Add each expense individually and optionally link it to a stop or reservation.
- Preserve original amount, currency, conversion rate, rate date, and KRW total.
- Fetch the latest available reference rate from a named provider and show the update timestamp.
- Do not silently rewrite old expenses when exchange rates change. Offer an explicit revaluation action.
- Distinguish a daily reference rate from a continuously updating market quote.

### Preparation checklist
- Generate a useful starter checklist automatically after trip creation.
- Use destination, trip length, travel mode, number of travelers, and reservations to select tasks.
- Examples: passport/entry checks for international trips, transport passes when relevant, booking confirmation, eSIM, payment preparation, weather-aware packing, and check-in reminders.
- Avoid duplicate tasks when reservations or trip details change.
- Let users edit, assign, reorder, complete, and delete tasks.

## Data architecture

The current JSONB trip document is retained temporarily for backward compatibility. WAYPOINT v2 adds normalized tables:
- `trip_days`
- `trip_stops`
- `trip_reservations`
- `trip_expenses`
- `trip_checklist_items`
- `trip_notes`

Every exposed table has RLS enabled and ownership policies based on the owning row in `public.trips`. Existing trips are not deleted or rewritten by the schema migration. A later data migration can copy legacy JSONB into the normalized tables after round-trip tests are in place.

## Engineering requirements

- Replace the single large UI module with focused modules for auth, trip data, itinerary, maps, reservations, budget, checklist, notes, and integrations.
- Use a single source of truth for trip data and a repository layer for Supabase reads/writes.
- All mutations must have pending, success, and error states; avoid permanent spinners.
- Autosave with clear saved/saving/offline states.
- Use real provider data only. Show unavailable states and provider errors honestly.
- Add automated browser tests for creation, editing, drag reorder, route calculation, document extraction review, expense conversion, checklist generation, responsive navigation, and reload persistence.
- Preserve existing trips and provide a rollback path until the v2 data migration is verified.
