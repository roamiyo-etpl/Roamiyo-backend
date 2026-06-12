# Cancellation Charges API (`POST /cancellation-charges`)

Get an **estimated** refund amount and cancellation penalty from the flight supplier (TBO) **before** the user confirms cancellation. This does **not** cancel the ticket.

Use the same `requestType` and `supplierParams` when you later call `POST /cancel` so the quote matches the cancellation action.

---

## Endpoint

| | |
|--|--|
| **Method** | `POST` |
| **Path** | `/cancellation-charges` |
| **Mode** | `flight` (hotel not implemented) |

---

## Required headers

| Header | Example |
|--------|---------|
| `api-version` | `v1` |
| `currency-preference` | `INR` |
| `ip-address` | Client IP (or server uses `TBO_END_USER_IP` env for TBO) |
| `language` | `english` |
| `club-id` | `1` |
| `device-information` | `web` / `test-device` |
| `content-type` | `application/json` |

---

## Request body (common fields)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | `"flight"` \| `"hotel"` | Yes | Must be `flight` for TBO flight bookings |
| `bookingId` | number | Yes | TBO supplier booking id (`supplier_reference_id` in your DB) |
| `requestType` | string | Yes | `FullCancellation` or `PartialCancellation` |
| `supplierParams` | object | Partial only | `sectors` and/or `ticketIds` for partial cancel |
| `segments` | array | Partial only (alias) | Same as `supplierParams.sectors`; copied automatically if `sectors` omitted |

---

## 1. Full cancellation charges

Cancels the **entire** booking (all legs / passengers on that TBO booking).

### Request example

```json
{
  "mode": "flight",
  "bookingId": 2131126,
  "requestType": "FullCancellation"
}
```

### What the backend sends to TBO

TBO `GetCancellationCharges` with:

- `RequestType`: **1** (Full)
- `BookingId`: your `bookingId`
- `BookingMode`: from internal `GetBookingDetails` (fallback `5`)
- No `Sectors` / `TicketId`

---

## 2. Partial cancellation charges

Cancels **specific sector(s)** or ticket(s). You must say which leg(s).

### Request example (recommended — `supplierParams.sectors`)

```json
{
  "mode": "flight",
  "bookingId": 2131126,
  "requestType": "PartialCancellation",
  "supplierParams": {
    "sectors": [
      {
        "origin": "BLR",
        "destination": "IXB"
      }
    ]
  }
}
```

### Request example (ticket IDs)

```json
{
  "mode": "flight",
  "bookingId": 2131126,
  "requestType": "PartialCancellation",
  "supplierParams": {
    "ticketIds": [12345678]
  }
}
```

### Request example (`segments` alias)

Same as sectors; normalized to `supplierParams.sectors` in code:

```json
{
  "mode": "flight",
  "bookingId": 2131126,
  "requestType": "PartialCancellation",
  "segments": [
    {
      "origin": "BLR",
      "destination": "IXB"
    }
  ]
}
```

### What the backend sends to TBO

TBO `GetCancellationCharges` with:

- `RequestType`: **2** (Partial)
- `BookingId`, `BookingMode` (same as full)
- **`Sectors`**: `[{ "Origin": "BLR", "Destination": "IXB" }]` when sectors provided
- **`TicketId`**: array when `ticketIds` provided

At least one of `Sectors` or `TicketId` is required for partial; otherwise API returns **400**.

---

## Success response

```json
{
  "success": true,
  "supplierResponseStatus": "Successfull",
  "refundAmount": 2126,
  "cancellationCharge": 4270,
  "remarks": "Cancellation charges may vary as per the airline policy.",
  "currency": "INR",
  "traceId": "d5816a1e-1163-4480-a3a6-eabd44bef470"
}
```

| Field | Meaning |
|-------|---------|
| `success` | `true` when TBO `ResponseStatus === 1` |
| `refundAmount` | Estimated amount refundable to customer |
| `cancellationCharge` | Estimated airline/supplier penalty |
| `currency` | e.g. `INR` |
| `traceId` | TBO trace; store with quote for support |
| `remarks` | Supplier disclaimer when provided |

**Important:** These are **estimates**. Final amounts after real cancellation come from `GetChangeRequestStatus` on `POST /cancel`.

---

## Error responses

| HTTP | When |
|------|------|
| **400** | Missing `mode`, `bookingId`, `requestType`; partial without sectors/ticketIds |
| **404** | Booking not found in DB; provider not configured |
| **200** with `success: false` | TBO returned failed status (check `supplierResponseStatus`, `error`) |

Partial validation example:

```json
{
  "statusCode": 400,
  "message": "Sectors or ticket IDs are required for partial cancellation charges"
}
```

---

## Internal flow (flight + TBO)

```text
POST /cancellation-charges
  → Generic cancel router (mode = flight)
  → Flight CancelService.getCancellationCharges
       · Load booking by supplier_reference_id
       · Normalize segments → supplierParams.sectors
       · Validate partial: sectors or ticketIds
       · Set supplierParams.providerCode from booking
  → ProviderCancellationService → TboCancellationService.fetchCancellationCharges
       1. TBO Authenticate
       2. TBO GetBookingDetails (log: …-precharges-getbookingdetails-TBO)
       3. TBO GetCancellationCharges (with Sectors/TicketId if partial)
  → Return mapped response
```

Supplier logs: `/logs/flight/cancellation/cancel-{timestamp}-getcancellationcharges-TBO.json`

---

## Code changes (summary)

| File | Change |
|------|--------|
| `src/modules/cancel/dto/cancel.dto.ts` | `GenericGetCancellationChargesDto`: added `supplierParams`, `segments` |
| `src/modules/cancel/dto/cancel.dto.ts` | `GenericCancelDto`: added `segments` alias for `/cancel` |
| `src/modules/flight/cancel/cancel.service.ts` | Validate `requestType`; normalize `segments`; shared partial validation |
| `src/modules/flight/cancel/dtos/cancel.dto.ts` | `GetCancellationChargesRequestDto`: optional `TicketId`, `Sectors` |
| `src/modules/flight/providers/tbo/tbo-cancellation.service.ts` | `applyPartialCancellationFields()` on GetCancellationCharges + SendChangeRequest |
| `src/modules/cancel/cancel.controller.ts` | Swagger description points to this doc |

---

## Product flow (your app)

```text
1. User opens cancel
      → POST /cancellation-charges  (this API)

2. UI shows refundAmount, cancellationCharge, disclaimer

3. User confirms
      → POST /cancel  (same requestType + supplierParams)

4. When TBO status = Completed
      → Admin manual Razorpay refund using final refundedAmount from cancel response
```

---

## Testing checklist

- [ ] **Full:** body with `FullCancellation` only → TBO log shows `RequestType: 1`, no `Sectors`
- [ ] **Partial:** body with `PartialCancellation` + `supplierParams.sectors` → TBO log shows `RequestType: 2` + `Sectors`
- [ ] **Partial alias:** same with top-level `segments` only
- [ ] **Partial invalid:** `PartialCancellation` without sectors/ticketIds → 400
- [ ] Compare full vs partial amounts for a multi-leg booking (e.g. BLR–IXB–DEL)

---

## Related

- TBO integration notes: `docs/tbo-flight-integration-updates.md` (`BookingMode`, `EndUserIp`)
- Actual cancel: `POST /cancel` → `SendChangeRequest` → `GetChangeRequestStatus`
