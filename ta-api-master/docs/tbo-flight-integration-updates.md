# TBO flight integration updates

This document describes changes made to Tek Travels (TBO) flight flows: **authentication**, **cancellation / cancellation charges**, **client IP handling**, **logging hygiene**, and **SSR shape on Book/Ticket** for LCC vs Non-LCC.

---

## 1. Shared request context (`src/shared/utilities/flight/tbo-request-context.utility.ts`)

### `resolveTboEndUserIp(headers)`

TBO expects the **same `EndUserIp`** on **Authenticate** and on subsequent Air APIs for that session.

**Resolution order:**

1. **`TBO_END_USER_IP`** environment variable (if set) — use for fixed egress / whitelisted server IP in Azure or similar.
2. Otherwise, consider candidates in this order: **`ip-address`** header, **`x-forwarded-for`** (first hop), **`x-real-ip`**.
3. **Skip “unsuitable” client IPs** when a better candidate exists: loopback (`127.0.0.1`, `::1`), RFC1918 private ranges (`10.*`, `192.168.*`, `172.16–31.*`), link-local (`169.254.*`), and `0.0.0.0`. This avoids sending `127.0.0.1` to TBO when the real edge IP is present in `x-forwarded-for` (e.g. Azure Container Apps / Envoy).
4. If every candidate is unsuitable but non-empty, the first non-empty value is still used.
5. Final fallback: **`20.244.28.12`** (legacy default aligned with prior booking behaviour).

### `redactTboCredentialsForLog(cred)`

Returns a shallow copy of provider credentials with **`password`** / **`Password`** replaced by **`[REDACTED]`** so logs and supplier log files do not contain plaintext secrets.

---

## 2. Authentication (`src/modules/flight/providers/tbo/tbo-auth-token.service.ts`)

- **`Authenticate`** request body now uses **`resolveTboEndUserIp(headers)`** instead of only `headers["ip-address"]`, so auth matches the IP logic used on Air APIs.
- **`getNewAuthToken`** file logs: request payload uses redacted password; **`ApiRequest`** embeds **redacted** `providerCred`.
- When **`ENABLE_LOCAL_LOGS`** is true, cached-token auth logs also use **redacted** `providerCred` (no full credentials in log files).

---

## 3. Cancellation and cancellation charges (`src/modules/flight/providers/tbo/tbo-cancellation.service.ts`)

### Consistent `EndUserIp`

All TBO calls in this service now use **`resolveTboEndUserIp(headers)`** instead of hardcoded or header-only values:

- `releasePNR`
- `sendChangeRequest`
- `getChangeRequestStatus`
- `getBookingDetails`
- `getCancellationCharges`

This aligns **Authenticate** (via auth service) and **cancellation** calls on one IP strategy.

### `GetCancellationCharges` and `BookingMode`

Before calling **`GetCancellationCharges`**, the service calls **`GetBookingDetails`** (with a distinct log prefix `…-precharges-getbookingdetails-TBO`).

- If **`FlightItinerary.BookingMode`** exists and is a **number**, that value is sent on **`GetCancellationCharges`**.
- The itinerary is read from either **`Response.FlightItinerary`** or **`Response.Response.FlightItinerary`** (TBO response shape variants).
- If **`BookingMode`** is not available, the code falls back to **`5`** (previous hardcoded behaviour).

**Release PNR** `Source` is taken from the same itinerary helper for consistency.

### Logging

Console logs that printed full **`providerCred`** now print **`redactTboCredentialsForLog(providerCred)`**.

### Cleanup

Removed unused imports (`CancelFlightDto`, `Generic`) where applicable.

---

## 4. Provider cancellation wrapper (`src/modules/flight/providers/provider-cancellation.service.ts`)

- Replaced the **array-with-named-properties** pattern (`const cancelRequest = []; cancelRequest['cancelReq'] = …`) with a normal object **`{ cancelReq, providerCred, headers, booking? }`** so `JSON.stringify` in logs shows real contents.
- **`providerCancel`** and **`providerCancellationCharges`** both pass this object into the TBO cancellation service.
- Parsed provider credentials in logs use **`redactTboCredentialsForLog`**.

---

## 5. Book flow — SSR LCC vs Non-LCC (`src/modules/flight/providers/tbo/tbo-book.service.ts`)

### Tek / TBO rule (as documented)

- **LCC:** SSR (meal / baggage / seat) is sent as a **JSON array** of objects: `[{ ... }, { ... }]`.
- **Non-LCC:** SSR should **not** be sent as that top-level array; it should be sent as a **JSON object** (documentation often describes this as `{ }` vs `[ { } ]`).

### Implementation

1. **`toNonLccSsrObject(items: any[])`**  
   Converts `[a, b, c]` → **`{ "0": a, "1": b, "2": c }`**.  
   This keeps internal pipelines (`bookReq.ssr`, `mapSSR`, filters) as **arrays**, and only changes the **wire format** on each **`Passengers[]`** element for Non-LCC.

2. **`createBookRequest`**
   - Reads **`airlineType`** from **`bookRequest.airlineType`** or **`bookReq.airlineType`** (supports split-booking updates that set type on `bookReq`).
   - **`isNonLcc`** when `airlineType === "Non-LCC"`.
   - For each passenger, **`MealDynamic`**, **`SeatDynamic`**, and **`Baggage`**:
     - **Non-LCC:** pass **`toNonLccSsrObject(...)`** (meals still get `Nationality` enrichment before conversion).
     - **LCC or unknown type:** unchanged — **arrays** as before.

### Operational note

If TBO’s official **Book** sample for Non-LCC uses a **different** object shape (e.g. nested wrapper, or a stringified JSON field), adjust **`toNonLccSsrObject`** or the three branches in **`createBookRequest`** to match **TBO Sample JSON** exactly. The keyed-object form is the standard interpretation of “object instead of array” for multi-segment SSR.

---

## 6. Book — `EndUserIp` helper (`tbo-book.service.ts`)

**`resolveEndUserIp(bookRequest)`** now delegates to **`resolveTboEndUserIp(bookRequest?.headers)`** so booking uses the same IP rules as auth and cancellation (including **`TBO_END_USER_IP`** and private-IP skipping).

> Note: **`createBookRequest`** still sets **`EndUserIp: headers["ip-address"]`** on the Book/Ticket body in places; a follow-up improvement is to use **`this.resolveEndUserIp(bookRequest)`** there for full consistency. This doc reflects the state of the codebase when written; grep for `EndUserIp` in `tbo-book.service.ts` to confirm.

---

## 7. Environment variable

| Variable           | Purpose |
|--------------------|---------|
| **`TBO_END_USER_IP`** | Optional. If set, **all** `resolveTboEndUserIp` consumers use this value first (recommended for server-to-server calls when the client sends `127.0.0.1` as `ip-address`). |

---

## 8. File checklist

| File | Summary |
|------|---------|
| `src/shared/utilities/flight/tbo-request-context.utility.ts` | New: `resolveTboEndUserIp`, `redactTboCredentialsForLog`. |
| `src/modules/flight/providers/tbo/tbo-auth-token.service.ts` | Auth uses resolved IP; redacted logs. |
| `src/modules/flight/providers/tbo/tbo-cancellation.service.ts` | Resolved IP everywhere; charges + `BookingMode` from details; redacted logs; itinerary helper. |
| `src/modules/flight/providers/provider-cancellation.service.ts` | Object payload; redacted credential logs. |
| `src/modules/flight/providers/tbo/tbo-book.service.ts` | `toNonLccSsrObject`; Non-LCC SSR object wire format; `resolveEndUserIp` uses shared utility. |

---

## 9. How to verify

1. **Cancellation charges:** Confirm logs show one consistent **`EndUserIp`** from auth through **`GetCancellationCharges`**; optional second log file for pre-charges **`GetBookingDetails`**.
2. **Non-LCC book:** Inspect outbound **`Book`** JSON — **`Passengers[n].SeatDynamic`** (and meal/baggage if present) should be **objects with `"0"`, `"1"`, …** keys, not top-level arrays.
3. **LCC book / ticket:** **`Passengers[n]`** SSR fields should remain **arrays**.
4. **Logs:** No plaintext **`password`** in provider credential dumps.

---

*Document generated for the Roamiyo / Travel Tek `ta-api-master` TBO integration changes.*
