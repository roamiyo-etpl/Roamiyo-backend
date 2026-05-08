# TBO: passthrough of `FareRules` and `MiniFareRules` (search + revalidate)

## Purpose

TBO returns **`FareRules`** and **`MiniFareRules`** on **Air Search** and typically on **FareQuote** (revalidate) as well. `MiniFareRules` includes structured rows such as **Cancellation** and **Reissue** (and any other `Type` values TBO returns). These fields are attached to API responses **without filtering or reshaping** supplier objects.

## Files changed (revert checklist)

Revert by undoing the edits in the same files, in reverse order.

| File | What changed |
|------|----------------|
| `src/modules/flight/search/interfaces/start-routing.interface.ts` | On class `Route`, optional `fareRules?: unknown[]` and `miniFareRules?: unknown[]` with JSDoc. **Revert:** delete those two properties and their comments. |
| `src/modules/flight/providers/tbo/tbo-search.service.ts` | (1) Domestic roundtrip merge: `MiniFareRules` concatenation after `FareRules`. **Revert:** remove the `MiniFareRules: [...]` block. (2) Before `return flightRoute` in search `convertingResponse`, assign `fareRules` / `miniFareRules` from `flightJourney`. **Revert:** remove those two lines. |
| `src/modules/flight/revalidate/interfaces/revalidate.interface.ts` | On `RevalidateData`: replaced unused `fareRules?: FareRules[]` with **`fareRules?: unknown[]`** (TBO passthrough) and added **`miniFareRules?: unknown[]`**. The `FareRules` **class** in this file is unchanged (still used elsewhere, e.g. order/book types). **Revert:** restore `fareRules?: FareRules[]` and remove `miniFareRules`. |
| `src/modules/flight/providers/tbo/tbo-revalidate.service.ts` | (1) In `convertingResponse`, before `return flightRoute`, set `fareRules` / `miniFareRules` from `flightJourney`. **Revert:** remove those two lines. (2) In merged roundtrip `route` object, add `fareRules` / `miniFareRules` arrays concatenating leg 0 and leg 1. **Revert:** remove those two properties from the merged `route`. |
| `docs/FLIGHT_SEARCH_TBO_FARE_RULES_PASSTHROUGH.md` | This documentation file. **Revert:** delete the file. |

## API shape

### Search — `POST flight/search/start-routing`

Each element of `route[]` may include:

- **`fareRules`** — TBO `FareRules` for that option.
- **`miniFareRules`** — TBO `MiniFareRules` for that option.

For **domestic roundtrip** pairing in TBO search `convertingResponse`, `miniFareRules` (and `fareRules`) concatenate outbound + inbound supplier arrays.

### Revalidate — TBO FareQuote response

`route` may include the same keys from the **FareQuote** `Results` object for each leg. For **roundtrip** (two FareQuote calls merged in `revalidate`), `fareRules` and `miniFareRules` concatenate both legs, same idea as segments.

Omitted keys mean the supplier did not send that field for that option.

## Notes

- Payload size can grow when these arrays are large.
- Only the **TBO** paths populate these fields today.
- Clients should treat inner fields as **supplier-defined** and subject to change by TBO.
