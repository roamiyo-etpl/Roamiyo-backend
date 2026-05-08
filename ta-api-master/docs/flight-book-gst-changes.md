# Flight book: GST

## Client payload (`gst`)

```json
"gst": {
  "gstNumber": "",
  "gstCompanyName": "",
  "gstCompanyEmail": "",
  "gstCompanyContactNumber": "",
  "gstCompanyAddress": ""
}
```

## Behaviour

- **`normalizeBookRequestGst()`** on **initiate** and **confirmation** trims values and turns blank strings into omitted fields (so TBO / storage see clean data).
- **`gstCompanyEmail`**: DTO uses `@Transform` so `""` passes validation before `@IsEmail()`.
- **Legacy:** stored logs that only have **`gst_details`** are promoted to **`gst`** during confirmation before normalization.

## Files

| File | Role |
|------|------|
| `src/modules/flight/book/dtos/book.dto.ts` | `GSTDetails`, `normalizeBookRequestGst()` |
| `src/modules/flight/book/book.service.ts` | Calls normalize on initiate + confirmation |

TBO still maps `bookReq.gst` in `tbo-book.service.ts`.

## Revert

Revert `book.dto.ts` and `book.service.ts` (and this doc) to drop GST handling.
