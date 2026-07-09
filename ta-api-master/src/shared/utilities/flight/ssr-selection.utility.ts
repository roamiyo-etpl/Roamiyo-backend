import {
  hasSeatSelectionInSsr,
  SsrByPassengerIndex,
} from './tbo-indigo-seat.utility';

type SsrBuckets = {
  SeatDynamic?: unknown[];
  MealDynamic?: unknown[];
  Baggage?: unknown[];
};

function bucketHasSelection(bucket: SsrBuckets | null | undefined): boolean {
  if (!bucket) return false;
  return (
    (Array.isArray(bucket.SeatDynamic) && bucket.SeatDynamic.length > 0) ||
    (Array.isArray(bucket.MealDynamic) && bucket.MealDynamic.length > 0) ||
    (Array.isArray(bucket.Baggage) && bucket.Baggage.length > 0)
  );
}

/** True when the user selected any seat, meal, or baggage ancillary. */
export function hasAnySsrSelection(
  ssr: SsrByPassengerIndex | null | undefined,
  passengers?: SsrBuckets[] | null,
): boolean {
  if (hasSeatSelectionInSsr(ssr)) return true;
  if (ssr && typeof ssr === 'object') {
    for (const pax of Object.values(ssr)) {
      if (bucketHasSelection(pax)) return true;
    }
  }
  if (passengers?.length) {
    for (const pax of passengers) {
      if (bucketHasSelection(pax)) return true;
    }
  }
  return false;
}
