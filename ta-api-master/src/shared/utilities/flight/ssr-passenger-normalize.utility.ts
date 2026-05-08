/**
 * When the client sends SSR (seats/meals/baggage) bundled under a single
 * `Passengers[0]` entry, TBO mapping only runs for index 0 and the supplier
 * receives multiple seats on one pax. We expand to one slot per booking
 * passenger and assign items round-robin to seat-eligible travellers (no seats
 * for INF) only in this single-bucket shape.
 *
 * If client already sends one `Passengers[i]` bucket per traveler index,
 * indexes are preserved as-is (including intentional empty buckets).
 */

export type SsrPassengerBucket = {
  Baggage?: any[];
  MealDynamic?: any[];
  SeatDynamic?: any[];
};

function isInfant(passengers: any[], i: number): boolean {
  return passengers[i]?.passengerType === "INF";
}

function nonInfantIndices(passengers: any[]): number[] {
  return passengers
    .map((_, i) => i)
    .filter((i) => !isInfant(passengers, i));
}

function indicesWithItems(
  userSSR: SsrPassengerBucket[],
  key: "SeatDynamic" | "MealDynamic" | "Baggage",
): number[] {
  return userSSR
    .map((p, i) => ((p?.[key]?.length ?? 0) > 0 ? i : -1))
    .filter((i) => i >= 0);
}

function flatItems(
  userSSR: SsrPassengerBucket[],
  key: "SeatDynamic" | "MealDynamic" | "Baggage",
): any[] {
  return userSSR.flatMap((p) => [...(p?.[key] ?? [])]);
}

function cloneItem(x: any): any {
  return x && typeof x === "object" ? { ...x } : x;
}

/**
 * @param passengers `bookReq.passengers` in booking order (ADT, CHD, INF, …)
 * @param userSSR SSR selections from `Passengers` and/or `ssr` map shape
 */
export function normalizeBundledSsrPerPassengers(
  passengers: any[],
  userSSR: SsrPassengerBucket[],
): SsrPassengerBucket[] {
  const n = passengers.length;
  if (n === 0) return userSSR;

  const eligible = nonInfantIndices(passengers);
  // Auto-redistribute only when client sends a single bundled SSR bucket.
  // If SSR has one bucket per passenger (even with empty objects), keep indexes as-is.
  const fromSingleBundledBucket = userSSR.length <= 1;

  const flatSeats = flatItems(userSSR, "SeatDynamic");
  const seatIdxs = indicesWithItems(userSSR, "SeatDynamic");
  const redistributeSeats =
    fromSingleBundledBucket &&
    flatSeats.length > 0 &&
    seatIdxs.length === 1 &&
    flatSeats.length > 1 &&
    eligible.length >= flatSeats.length;

  const flatMeals = flatItems(userSSR, "MealDynamic");
  const mealIdxs = indicesWithItems(userSSR, "MealDynamic");
  const redistributeMeals =
    fromSingleBundledBucket &&
    flatMeals.length > 0 &&
    mealIdxs.length === 1 &&
    flatMeals.length > 1 &&
    eligible.length >= flatMeals.length;

  const flatBaggage = flatItems(userSSR, "Baggage");
  const bagIdxs = indicesWithItems(userSSR, "Baggage");
  const redistributeBaggage =
    fromSingleBundledBucket &&
    flatBaggage.length > 0 &&
    bagIdxs.length === 1 &&
    flatBaggage.length > 1 &&
    eligible.length >= flatBaggage.length;

  const alreadyAligned =
    userSSR.length === n &&
    !redistributeSeats &&
    !redistributeMeals &&
    !redistributeBaggage;

  if (alreadyAligned) {
    return stripInfantSeats(passengers, pruneEmptyBuckets(userSSR));
  }

  const out: SsrPassengerBucket[] = Array.from({ length: n }, (_, i) => {
    const base =
      userSSR[i] && typeof userSSR[i] === "object" ? { ...userSSR[i] } : {};
    delete base.SeatDynamic;
    delete base.MealDynamic;
    delete base.Baggage;
    return base;
  });

  if (redistributeSeats) {
    flatSeats.forEach((seat, j) => {
      const pIdx = eligible[j];
      if (pIdx === undefined) return;
      if (!out[pIdx].SeatDynamic) out[pIdx].SeatDynamic = [];
      out[pIdx].SeatDynamic!.push(cloneItem(seat));
    });
  } else {
    userSSR.forEach((p, i) => {
      if (i >= n || !p?.SeatDynamic?.length) return;
      if (isInfant(passengers, i)) return;
      out[i].SeatDynamic = p.SeatDynamic.map((s) => cloneItem(s));
    });
  }

  if (redistributeMeals) {
    flatMeals.forEach((meal, j) => {
      const pIdx = eligible[j];
      if (pIdx === undefined) return;
      if (!out[pIdx].MealDynamic) out[pIdx].MealDynamic = [];
      out[pIdx].MealDynamic!.push(cloneItem(meal));
    });
  } else {
    userSSR.forEach((p, i) => {
      if (i >= n || !p?.MealDynamic?.length) return;
      out[i].MealDynamic = p.MealDynamic.map((m) => cloneItem(m));
    });
  }

  if (redistributeBaggage) {
    flatBaggage.forEach((b, j) => {
      const pIdx = eligible[j];
      if (pIdx === undefined) return;
      if (!out[pIdx].Baggage) out[pIdx].Baggage = [];
      out[pIdx].Baggage!.push(cloneItem(b));
    });
  } else {
    userSSR.forEach((p, i) => {
      if (i >= n || !p?.Baggage?.length) return;
      out[i].Baggage = p.Baggage.map((b) => cloneItem(b));
    });
  }

  return stripInfantSeats(passengers, pruneEmptyBuckets(out));
}

function pruneEmptyBuckets(buckets: SsrPassengerBucket[]): SsrPassengerBucket[] {
  return buckets.map((b) => {
    const o: SsrPassengerBucket = { ...b };
    if (!o.SeatDynamic?.length) delete o.SeatDynamic;
    if (!o.MealDynamic?.length) delete o.MealDynamic;
    if (!o.Baggage?.length) delete o.Baggage;
    return o;
  });
}

function stripInfantSeats(
  passengers: any[],
  userSSR: SsrPassengerBucket[],
): SsrPassengerBucket[] {
  return pruneEmptyBuckets(
    userSSR.map((p, i) => {
      if (!isInfant(passengers, i) || !p?.SeatDynamic?.length) return p;
      const { SeatDynamic: _s, ...rest } = p;
      return rest;
    }),
  );
}

/**
 * Convert normalized buckets to `ssr` object keyed by "0".."n-1" for DB storage.
 */
export function ssrBucketsToNumericRecord(
  buckets: SsrPassengerBucket[],
): Record<string, SsrPassengerBucket> {
  const out: Record<string, SsrPassengerBucket> = {};
  buckets.forEach((b, i) => {
    const pruned = pruneEmptyBuckets([b])[0];
    if (Object.keys(pruned).length > 0) out[String(i)] = pruned;
  });
  return out;
}
