/**
 * Star-rating mix used to rank hotel search results.
 *
 * The pattern repeats over the whole result list, so every page of 10 gets exactly this mix
 * (3 × 5★, 3 × 4★, 3 × 3★, 1 × 2★). Change the numbers or their order here to change the ranking.
 *
 * - Within each star rating, hotels keep the requested sort (default: price low → high).
 * - If a rating runs out, the slot is filled with the nearest available rating (ties go to the higher star).
 * - Hotels with a rating not in this pattern (e.g. 1★, unrated) are shown after all the others.
 * - Not applied when the client explicitly sorts by rating.
 */
export const HOTEL_STAR_MIX_PATTERN: number[] = [5, 3, 4, 3, 5, 4, 3, 5, 4, 2];
