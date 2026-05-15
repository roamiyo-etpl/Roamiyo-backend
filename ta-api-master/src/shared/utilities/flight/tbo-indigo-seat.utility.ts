/** IndiGo (TBO) airline code — seat fallback applies only to this carrier per Tek Travels. */
export const TBO_INDIGO_AIRLINE_CODE = '6E';

export type SsrByPassengerIndex = Record<string | number, SsrPassengerBuckets>;

export type SsrPassengerBuckets = {
  SeatDynamic?: unknown[];
  MealDynamic?: unknown[];
  Baggage?: unknown[];
};

/**
 * Reads `IsBookableIfSeatNotAvailable` from stored/raw FareQuote (handles nested Results shapes).
 */
export function getFareQuoteIsBookableIfSeatNotAvailable(
  fareQuote: { Response?: { Results?: unknown } } | null | undefined,
): boolean | undefined {
  const results = fareQuote?.Response?.Results;
  if (results == null) return undefined;

  if (
    typeof results === 'object' &&
    !Array.isArray(results) &&
    typeof (results as { IsBookableIfSeatNotAvailable?: boolean })
      .IsBookableIfSeatNotAvailable === 'boolean'
  ) {
    return (results as { IsBookableIfSeatNotAvailable: boolean })
      .IsBookableIfSeatNotAvailable;
  }

  const journeys: unknown[] = Array.isArray(results)
    ? Array.isArray((results as unknown[])[0])
      ? (results as unknown[][]).flat()
      : (results as unknown[])
    : [];

  for (const journey of journeys) {
    if (
      journey &&
      typeof journey === 'object' &&
      typeof (journey as { IsBookableIfSeatNotAvailable?: boolean })
        .IsBookableIfSeatNotAvailable === 'boolean'
    ) {
      return (journey as { IsBookableIfSeatNotAvailable: boolean })
        .IsBookableIfSeatNotAvailable;
    }
  }

  return undefined;
}

/** Collect operating airline codes from FareQuote `Segments`. */
export function fareQuoteAirlineCodes(
  fareQuote: { Response?: { Results?: unknown } } | null | undefined,
): string[] {
  const results = fareQuote?.Response?.Results;
  if (results == null) return [];

  const codes = new Set<string>();
  const journeys: unknown[] =
    typeof results === 'object' && !Array.isArray(results)
      ? [results]
      : Array.isArray(results)
        ? Array.isArray((results as unknown[])[0])
          ? (results as unknown[][]).flat()
          : (results as unknown[])
        : [];

  for (const journey of journeys) {
    const segments = (journey as { Segments?: unknown })?.Segments;
    if (!segments) continue;
    const segmentGroups = Array.isArray(segments) ? segments : [segments];
    for (const group of segmentGroups) {
      const legs = Array.isArray(group) ? group : [group];
      for (const leg of legs) {
        const code = (leg as { Airline?: { AirlineCode?: string } })?.Airline
          ?.AirlineCode;
        if (code) codes.add(code);
      }
    }
  }

  return [...codes];
}

export function isIndigoFareQuote(
  fareQuote: { Response?: { Results?: unknown } } | null | undefined,
): boolean {
  return fareQuoteAirlineCodes(fareQuote).includes(TBO_INDIGO_AIRLINE_CODE);
}

export function isIndigoAirlineCodeList(airlineCodes: string[] | undefined): boolean {
  return (airlineCodes ?? []).includes(TBO_INDIGO_AIRLINE_CODE);
}

export function hasSeatSelectionInSsr(
  ssr: SsrByPassengerIndex | null | undefined,
): boolean {
  if (!ssr || typeof ssr !== 'object') return false;
  return Object.values(ssr).some(
    (pax) =>
      Array.isArray(pax?.SeatDynamic) && (pax.SeatDynamic as unknown[]).length > 0,
  );
}

export type ResolveIsAllowBookingWithoutSeatParams = {
  /** From FareQuote or revalidate `route.airlineCode` */
  isIndigo: boolean;
  isBookableIfSeatNotAvailable?: boolean;
};

/**
 * Whether to send `IsAllowBookingWithoutSeat` on TBO Book/Ticket (IndiGo / 6E only).
 *
 * Product rule: when FareQuote `IsBookableIfSeatNotAvailable` is **true**, always send
 * `IsAllowBookingWithoutSeat: true` — regardless of whether the user selected a seat.
 * When it is **false** or missing, do **not** send the field (omit from TBO request).
 */
export function resolveIsAllowBookingWithoutSeat(
  params: ResolveIsAllowBookingWithoutSeatParams,
): boolean | undefined {
  const { isIndigo, isBookableIfSeatNotAvailable } = params;

  if (!isIndigo) {
    return undefined;
  }

  if (isBookableIfSeatNotAvailable === true) {
    return true;
  }

  return undefined;
}
