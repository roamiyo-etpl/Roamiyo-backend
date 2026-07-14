# Hotel Cancellation API

TBO hotel cancellation for Roamiyo Travel API (Travel Tek Pro).

- **Flight** cancellation charges: `POST /cancellation-charges` — see `docs/cancellation-charges-api.md`
- **Hotel** cancellation charges: **not in Travel Tek** — handled by the **payment service** using cancel policy stored in its DB
- **Hotel** actual cancel: `POST /cancel` only (this document)

---

## Overview

| Responsibility | Service |
|----------------|---------|
| Show estimated cancel charge/refund (hotel) | **Payment service** (own DB / cancel policy) |
| Execute hotel cancel via TBO | **Travel Tek Pro** — `POST /cancel` |

TBO hotel has no pre-cancel quote API. Final `CancellationCharge` and `RefundedAmount` come from `GetChangeRequestStatus` after cancel is initiated.

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/cancel` | Submit cancel + poll TBO until Processed/Rejected or timeout |
| `POST` | `/cancel/status` | Poll existing `changeRequestId` only (no new `SendChangeRequest`) |

Controller: `src/modules/cancel/cancel.controller.ts`

`POST /cancellation-charges` with `mode: "hotel"` returns **400** — use payment service instead.

---

## Required headers

| Header | Example |
|--------|---------|
| `api-version` | `v1` |
| `currency-preference` | `INR` |
| `ip-address` | Client IP (sent to TBO as `EndUserIp`) |
| `language` | `english` |
| `club-id` | `1` |
| `device-information` | `web` |
| `content-type` | `application/json` |

---

## `booking_id` vs `bookingId` (important)

Your API uses **two IDs**. TBO docs only show one — both are needed in Travel Tek:

| Your API field | TBO field | Purpose |
|----------------|-----------|---------|
| `bookingId` (number) | `BookingId` | TBO supplier booking id from book response → **sent to TBO** |
| `booking_id` (UUID string) | *(not sent to TBO)* | Internal `bookings.booking_id` → **DB lookup & validation only** |

**Why `booking_id`?**

1. Find the correct row in your `bookings` table
2. Verify `bookingId` matches `supplier_reference_id` (security)
3. Save `cancellations` record with correct foreign key
4. Block duplicate cancels

**TBO `SendChangeRequest` only receives `bookingId`** (as `BookingId`). `booking_id` never leaves Travel Tek.

---

## Cancel hotel booking

### Request

```json
{
  "mode": "hotel",
  "booking_id": "2b52fc08-fde0-43e4-9f34-b9d65b1b00b5",
  "bookingId": 2035975,
  "requestType": "FullCancellation",
  "supplierParams": {
    "remarks": "Customer requested cancellation via payment service"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `mode` | Yes | `"hotel"` |
| `booking_id` | Yes | Internal booking UUID (`bookings.booking_id`) — **not sent to TBO** |
| `bookingId` | Yes | TBO `BookingId` (`bookings.supplier_reference_id`) — **sent to TBO** |
| `requestType` | Yes | Use `FullCancellation` (DTO validation) |
| `supplierParams.remarks` | Optional | Sent to TBO `SendChangeRequest.Remarks` |

### Response fields (payment service must read these)

| Field | Meaning |
|-------|---------|
| `success` | `true` when cancel submitted and not Rejected |
| `cancelSubmitted` | `true` when TBO returned a `changeRequestId` |
| `cancelCompleted` | `true` only when TBO status = Processed (3) |
| `pendingCompletion` | `true` when status is Pending or InProgress — **poll `POST /cancel/status`** |
| `cancellationStatus` | Same as `cancelCompleted` (legacy boolean) |
| `hotelChangeRequestStatus` | Raw TBO enum 0–4 |
| `status` | Human label: `Pending`, `InProgress`, `Processed`, `Rejected` |

**Do not treat `pendingCompletion: true` as failure.** TBO often stays `InProgress` longer than the inline poll window.

### Success — fully processed

```json
{
  "success": true,
  "message": "Hotel cancellation processed successfully",
  "mode": "hotel",
  "cancelSubmitted": true,
  "cancelCompleted": true,
  "pendingCompletion": false,
  "cancellationStatus": true,
  "hotelChangeRequestStatus": 3,
  "cancellationCharge": 450,
  "refundedAmount": 4262.5,
  "status": "Processed",
  "changeRequestId": 199925,
  "traceId": "51f76eaf-c4ec-43f7-8d96-6288fcba7da1",
  "cancellationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Success — submitted but still in progress (poll later)

```json
{
  "success": true,
  "message": "Hotel cancellation is InProgress. Poll POST /cancel/status with changeRequestId until Processed.",
  "mode": "hotel",
  "cancelSubmitted": true,
  "cancelCompleted": false,
  "pendingCompletion": true,
  "cancellationStatus": false,
  "hotelChangeRequestStatus": 2,
  "status": "InProgress",
  "changeRequestId": 404404,
  "traceId": "51f76eaf-c4ec-43f7-8d96-6288fcba7da1",
  "cancellationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Failure response example

```json
{
  "success": false,
  "message": "Hotel cancellation was rejected by supplier",
  "mode": "TBO",
  "cancellationStatus": false,
  "status": "Rejected",
  "changeRequestId": 199925,
  "error": {
    "errorCode": 1,
    "errorMessage": "..."
  }
}
```

---

## Poll cancellation status (`POST /cancel/status`)

Use when `POST /cancel` returns `pendingCompletion: true`, or payment retries later.

### Request

```json
{
  "mode": "hotel",
  "booking_id": "2b52fc08-fde0-43e4-9f34-b9d65b1b00b5",
  "bookingId": 2139857,
  "changeRequestId": 404404,
  "cancellationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `mode` | Yes | `"hotel"` |
| `booking_id` | Yes | Internal booking UUID |
| `bookingId` | Yes | TBO supplier booking id |
| `changeRequestId` | Yes | From `POST /cancel` response |
| `cancellationId` | Optional | Existing `cancellations` row — speeds DB update |

This endpoint calls **only** `GetChangeRequestStatus` (no second `SendChangeRequest`). When status becomes `Processed`, Travel Tek updates `cancellations` and sets `bookings.booking_status` to CANCELLED.

### Inline polling config

Inside both `/cancel` and `/cancel/status`, Travel Tek polls TBO up to:

| Env var | Default | Meaning |
|---------|---------|---------|
| `HOTEL_CANCEL_POLL_MAX_ATTEMPTS` | `20` | Max `GetChangeRequestStatus` calls per request |
| `HOTEL_CANCEL_POLL_DELAY_MS` | `3000` | Delay between polls (ms) |

Default window ≈ **60 seconds**. Increase env vars if TBO is slow; payment should still poll `/cancel/status` if `pendingCompletion` remains true.

### Duplicate `POST /cancel` while in flight

If a prior cancel is still `Pending` or `InProgress`, a new `POST /cancel` **does not** call `SendChangeRequest` again. It resumes polling the existing `changeRequestId` and updates the same `cancellations` row.

### Duplicate `POST /cancel` when already Processed / cancelled

Returns **HTTP 200** (idempotent success) with `cancelCompleted: true`, `alreadyCancelled: true`, and the saved `changeRequestId` / credit-note fields. Does **not** call TBO again and does **not** return 400.

Example:

```json
{
  "success": true,
  "message": "Booking is already cancelled",
  "mode": "TBO-Production",
  "cancellationStatus": true,
  "cancelSubmitted": true,
  "cancelCompleted": true,
  "pendingCompletion": false,
  "alreadyCancelled": true,
  "hotelChangeRequestStatus": 3,
  "status": "Processed",
  "changeRequestId": 15706070,
  "cancellationId": "df9d3d7e-bd28-49fb-bf1b-02e0c4f00185",
  "refundedAmount": 1417,
  "cancellationCharge": 0,
  "creditNoteNo": "MZ/2627/105442",
  "creditNoteCreatedOn": "2026-07-13T13:53:49.000Z"
}
```

---

## TBO hotel ChangeRequestStatus

| Value | Label | `cancellationStatus` |
|-------|-------|----------------------|
| 0 | NotSet | false |
| 1 | Pending | false |
| 2 | InProgress | false |
| **3** | **Processed** | **true** |
| 4 | Rejected | false |

---

## Internal code flow

```
Payment service
  → shows estimate from its own DB (cancel policy)

Payment service
  → POST /cancel (mode=hotel, booking_id + bookingId)
      → cancel.controller.ts
      → cancel.service.ts (GenericCancelService)
      → hotel/cancel/cancel.service.ts (HotelCancelService)
          1. Validate booking_id + bookingId match in DB
          2. Duplicate / status checks
          3. If in-flight cancel (Pending/InProgress) → poll only, else SendChangeRequest
          4. hotel/providers/provider-cancellation.service.ts
          5. hotel/providers/tbo/tbo-cancellation.service.ts
              a. Authenticate → TokenId
              b. SendChangeRequest (BookingId = bookingId only) — skipped on resume
              c. GetChangeRequestStatus (poll until Processed/Rejected or timeout)
          6. hotel/cancel/cancel.repository.ts → save or update + update booking on Processed

POST /cancel/status → steps 4–6 only (poll existing changeRequestId)
```

### Log prefixes (server debugging)

| Prefix | Location |
|--------|----------|
| `[CANCEL][ENTRY]` | Generic cancel entry |
| `[CANCEL-HOTEL]` | Hotel cancel orchestration |
| `[HOTEL-PROVIDER-CANCEL]` | Provider routing |
| `[TBO-HOTEL-CANCEL][STEP-2] BEFORE/AFTER SendChangeRequest` | TBO cancel start |
| `[TBO-HOTEL-CANCEL][POLL-N] BEFORE/AFTER GetChangeRequestStatus` | TBO status polling |

---

## TBO supplier APIs (called internally)

### SendChangeRequest

- **URL:** `{providerCred.book_url}/SendChangeRequest`

```json
{
  "BookingMode": 5,
  "RequestType": 4,
  "Remarks": "Customer requested cancellation",
  "BookingId": 2035975,
  "EndUserIp": "123.00.00.00",
  "TokenId": "uuid-from-authenticate"
}
```

Note: only `BookingId` — no `booking_id`.

### GetChangeRequestStatus

- **URL:** `{providerCred.book_url}/GetChangeRequestStatus`

```json
{
  "BookingMode": 5,
  "ChangeRequestId": 199925,
  "EndUserIp": "123.00.00.00",
  "TokenId": "uuid-from-authenticate"
}
```

Returns final `CancellationCharge` and `RefundedAmount`.

---

## Database storage

### `bookings` (updated on successful cancel)

| Column | Value |
|--------|-------|
| `booking_status` | `3` (CANCELLED) when TBO status = Processed (3) |

### `cancellations` (new row per cancel attempt with `changeRequestId`)

| Column | Source |
|--------|--------|
| `cancellation_id` | UUID → `cancellationId` in response |
| `booking_id` | From request `booking_id` |
| `supplier_reference_id` | TBO `bookingId` |
| `change_request_id` | TBO `ChangeRequestId` |
| `cancellation_charge` | TBO final charge |
| `refunded_amount` | TBO final refund |
| `additional_data` | Full TBO audit payload |

```json
{
  "module": "hotel",
  "hotelChangeRequestStatus": 3,
  "hotelChangeRequestStatusText": "Processed",
  "cancellationStatus": true,
  "sendChangeRequestResponse": {},
  "getChangeRequestStatusResponse": {}
}
```

### Duplicate prevention

Blocked when booking is already `CANCELLED` or a prior cancel reached `hotelChangeRequestStatus: 3`.

---

## Files (hotel cancel)

| Path | Role |
|------|------|
| `src/modules/hotel/cancel/cancel.service.ts` | Orchestration |
| `src/modules/hotel/cancel/cancel.repository.ts` | DB |
| `src/modules/hotel/providers/provider-cancellation.service.ts` | Provider router |
| `src/modules/hotel/providers/tbo/tbo-cancellation.service.ts` | TBO + logs |
| `src/modules/cancel/cancel.service.ts` | Routes `mode: hotel` to cancel only |

Flight cancellation is unchanged.

---

## Payment service integration

### Step 1 — Estimate (payment service only)

Read cancel policy from **payment service DB**. Do not call Travel Tek `/cancellation-charges` for hotel.

### Step 2 — Cancel (Travel Tek)

```http
POST https://<travel-tek-host>/cancel
```

### Step 3 — Poll if needed

If `pendingCompletion: true`:

```http
POST https://<travel-tek-host>/cancel/status
```

Repeat until `cancelCompleted: true` (or `status: "Processed"`). Map `InProgress` / `Pending` to **in_progress**, not rejected.

Use `cancellationCharge` and `refundedAmount` for refund processing **only when** `cancelCompleted: true`.

### cURL example

```bash
curl -X POST 'https://<travel-tek-host>/cancel' \
  -H 'Content-Type: application/json' \
  -H 'api-version: v1' \
  -H 'currency-preference: INR' \
  -H 'ip-address: 192.168.1.1' \
  -H 'language: english' \
  -H 'club-id: 1' \
  -H 'device-information: web' \
  -d '{
    "mode": "hotel",
    "booking_id": "YOUR_INTERNAL_BOOKING_UUID",
    "bookingId": 2035975,
    "requestType": "FullCancellation",
    "supplierParams": {
      "remarks": "Cancelled by customer"
    }
  }'
```

---

## Error cases

| HTTP | Cause |
|------|-------|
| 400 | Missing fields, booking not found, invalid status, hotel on `/cancellation-charges` |
| 404 | Provider config not found |
| 500 | TBO auth or network failure |

---

## Testing checklist

- [ ] Payment service shows estimate from its own DB
- [ ] `POST /cancel` with valid `booking_id` + `bookingId`
- [ ] Response `status: "Processed"` and `cancelCompleted: true`
- [ ] If `pendingCompletion: true`, `POST /cancel/status` eventually returns Processed
- [ ] Second `POST /cancel` while InProgress resumes poll (no duplicate SendChangeRequest)
- [ ] `bookings.booking_status` = CANCELLED
- [ ] Row in `cancellations` with `additional_data`
- [ ] Second cancel returns 400
- [ ] `POST /cancellation-charges` with `mode: hotel` returns 400
- [ ] Server logs show BEFORE/AFTER for TBO APIs
