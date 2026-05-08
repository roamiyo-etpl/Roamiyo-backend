# SSR multi-passenger normalization and frontend payload guide

## What was fixed

### Root issue

When frontend sent SSR in one bundled bucket (usually only `Passengers[0]`), backend had to split SSR by passenger index.  
But when frontend already sent one bucket per passenger (for example `Passengers[1]` exists but empty), backend still redistributed seats and could move seats to the wrong passenger index.

This produced supplier errors like `Invalid Seat Data`.

### Current behavior

`normalizeBundledSsrPerPassengers` now redistributes only when payload is truly bundled:

- auto-redistribution runs only if SSR comes as a **single bucket** (`Passengers.length <= 1`)
- if SSR is already per-passenger (array length equals passenger count, even with empties), indexes are preserved
- `INF` passengers still cannot have seats (`SeatDynamic` stripped for infants)

Also, in `bookingInitiate`, `bookReq.Passengers` is normalized from the raw array (no forced padding before normalization), so "single bundled bucket" detection works correctly.

## Files changed

| File | Change |
|---|---|
| `src/shared/utilities/flight/ssr-passenger-normalize.utility.ts` | Restrict redistribution to single bundled SSR bucket |
| `src/modules/flight/book/book.service.ts` | Use raw `Passengers` array for normalization during initiate |
| `src/modules/flight/providers/tbo/tbo-book.service.ts` | Already consumes normalized SSR flow in book/ticket pipeline |

## Frontend payload format (recommended)

### Important contract

1. `passengers[i]` and `Passengers[i]` represent the same traveler index.
2. If passenger has no SSR, send empty arrays for that index.
3. For roundtrip:
   - non-stop: per selected passenger, one seat/meal/baggage item per direction as selected
   - layover: one item per segment as selected
4. For infants (`INF`), do not send `SeatDynamic`.

---

### A) Roundtrip non-stop, single passenger

```json
{
  "passengers": [{ "passengerType": "ADT" }],
  "Passengers": [
    {
      "SeatDynamic": [
        { "FlightNumber": "1040", "Origin": "BLR", "Destination": "DEL", "Code": "6C" },
        { "FlightNumber": "1070", "Origin": "DEL", "Destination": "BLR", "Code": "6B" }
      ],
      "MealDynamic": [
        { "FlightNumber": "1040", "Origin": "BLR", "Destination": "DEL", "Code": "VPMB" }
      ],
      "Baggage": [
        { "FlightNumber": "1040", "Origin": "BLR", "Destination": "DEL", "Code": "SBHA" }
      ]
    }
  ]
}
```

### B) Roundtrip non-stop, multiple passengers

```json
{
  "passengers": [
    { "passengerType": "ADT" },
    { "passengerType": "ADT" }
  ],
  "Passengers": [
    {
      "SeatDynamic": [
        { "FlightNumber": "1040", "Origin": "BLR", "Destination": "DEL", "Code": "6C" },
        { "FlightNumber": "1070", "Origin": "DEL", "Destination": "BLR", "Code": "6B" }
      ],
      "MealDynamic": [{ "FlightNumber": "1040", "Origin": "BLR", "Destination": "DEL", "Code": "VPMB" }],
      "Baggage": [{ "FlightNumber": "1040", "Origin": "BLR", "Destination": "DEL", "Code": "SBHA" }]
    },
    {
      "SeatDynamic": [],
      "MealDynamic": [],
      "Baggage": []
    }
  ]
}
```

> In this case second passenger stays empty by design; backend now preserves this.

---

### C) Roundtrip layover, single passenger

```json
{
  "passengers": [{ "passengerType": "ADT" }],
  "Passengers": [
    {
      "SeatDynamic": [
        { "FlightNumber": "269", "Origin": "BLR", "Destination": "BOM", "Code": "9B" },
        { "FlightNumber": "164", "Origin": "BOM", "Destination": "DEL", "Code": "7C" },
        { "FlightNumber": "2487", "Origin": "DEL", "Destination": "PNQ", "Code": "11A" },
        { "FlightNumber": "137", "Origin": "PNQ", "Destination": "BLR", "Code": "12C" }
      ],
      "MealDynamic": [
        { "FlightNumber": "164", "Origin": "BOM", "Destination": "DEL", "Code": "VGSW" }
      ],
      "Baggage": [
        { "FlightNumber": "269", "Origin": "BLR", "Destination": "DEL", "Code": "EB03" }
      ]
    }
  ]
}
```

### D) Roundtrip layover, multiple passengers

```json
{
  "passengers": [
    { "passengerType": "ADT" },
    { "passengerType": "ADT" }
  ],
  "Passengers": [
    {
      "SeatDynamic": [
        { "FlightNumber": "269", "Origin": "BLR", "Destination": "BOM", "Code": "9B" },
        { "FlightNumber": "164", "Origin": "BOM", "Destination": "DEL", "Code": "7C" }
      ],
      "MealDynamic": [{ "FlightNumber": "164", "Origin": "BOM", "Destination": "DEL", "Code": "VGSW" }],
      "Baggage": [{ "FlightNumber": "269", "Origin": "BLR", "Destination": "DEL", "Code": "EB03" }]
    },
    {
      "SeatDynamic": [
        { "FlightNumber": "269", "Origin": "BLR", "Destination": "BOM", "Code": "9C" },
        { "FlightNumber": "164", "Origin": "BOM", "Destination": "DEL", "Code": "7B" }
      ],
      "MealDynamic": [{ "FlightNumber": "164", "Origin": "BOM", "Destination": "DEL", "Code": "VGS1" }],
      "Baggage": [{ "FlightNumber": "269", "Origin": "BLR", "Destination": "DEL", "Code": "IB08" }]
    }
  ]
}
```

## Revert steps

1. Revert `src/shared/utilities/flight/ssr-passenger-normalize.utility.ts`.
2. Revert `src/modules/flight/book/book.service.ts` SSR bucket preparation.
3. Keep or remove this doc based on project docs policy.
