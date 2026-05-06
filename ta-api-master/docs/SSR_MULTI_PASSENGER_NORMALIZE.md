# SSR multi-passenger normalization (revert / changelog)

## Problem

- The client often sends all `SeatDynamic` (and sometimes multiple `MealDynamic` / `Baggage`) under a **single** `Passengers[0]` entry when several travellers have SSR.
- `TboBookService.buildUserSsrPassengersList` prefers `Passengers` and returns that array unchanged.
- `mapSSR` runs **per index**, so only passenger `0` was mapped and the TBO Ticketing payload put **multiple seats on one pax** (e.g. 6E). Infants must not hold seats; suppliers reject this with generic errors (e.g. ErrorCode 35).

## Fix (what changed)

1. **`src/shared/utilities/flight/ssr-passenger-normalize.utility.ts`** (new)
   - `normalizeBundledSsrPerPassengers(passengers, userSSR)`:
     - Builds one SSR bucket per `bookReq.passengers` entry (same order as booking).
     - If **all** seats are attached to **one** index and there is **more than one** seat, splits them **in list order** across passengers who are **not** `INF`.
     - Same bundling rule for **meals** and **baggage** (multiple items in one bucket → split across non-INF passengers in order).
     - **Strips `SeatDynamic` from infants** even if the client sent them by mistake.
   - `ssrBucketsToNumericRecord` converts the array to the `ssr` object shape stored in DB (`"0"`, `"1"`, …).

2. **`src/modules/flight/providers/tbo/tbo-book.service.ts`**
   - After `buildUserSsrPassengersList(bookReq)`, the list is passed through `normalizeBundledSsrPerPassengers(bookReq.passengers, …)` **before** `filterSsrByAllowedFlights` and `mapSSR`.

3. **`src/modules/flight/book/book.service.ts`** (`bookingInitiate`)
   - When persisting `ssr_response`, SSR is normalized the same way so confirmation reads per-passenger SSR from DB.

## How to revert

1. Delete `src/shared/utilities/flight/ssr-passenger-normalize.utility.ts`.
2. Remove imports and calls to `normalizeBundledSsrPerPassengers` / `ssrBucketsToNumericRecord` in:
   - `src/modules/flight/providers/tbo/tbo-book.service.ts`
   - `src/modules/flight/book/book.service.ts`
3. In `book.service.ts`, restore the previous `Passengers.reduce` block and `formattedSSR = { ...bookReq.ssr }` for the SSR-only branch (see git history).
4. Remove this doc if you do not want it in the tree.

## Behaviour / limitations

- **Seat order**: seats are assigned to non-INF passengers in **passenger list order** (first seat → first eligible pax, second → second eligible, …). The client should send seats in the same order as `passengers[]`.
- **Single bucket with one seat**: left on index `0` (first passenger); still OK for ADT+CHD+INF.
- **More seats than non-INF passengers**: redistribution is **not** applied (`eligible.length >= flatSeats.length` guard); seats stay on the original indices (may still fail at supplier).
- **Meals for infants**: not explicitly stripped; only seats are stripped for `INF`. If you need infant meals only on specific indices, send them per-passenger from the client.

## Files touched

| File | Role |
|------|------|
| `ssr-passenger-normalize.utility.ts` | Shared normalization |
| `tbo-book.service.ts` | TBO book / ticketing SSR pipeline |
| `book.service.ts` | Persist normalized `ssr_response` on initiate |
