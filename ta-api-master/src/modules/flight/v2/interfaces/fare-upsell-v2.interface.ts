import { RouteV2 } from './start-routing-v2.interface';

/** One inclusion of the fare, from TBO Inclusions[] (e.g. Seat, Meal, Baggage) */
export class UpsellInclusionV2 {
    key: string;
    label: string;
    status: 'included' | 'chargeable';
    isPaid: boolean;
    price: number | null;
    currency: string;
}

/** One service of the fare family, from TBO UpsellOptionsList.UpsellList[].ServicesList[] */
export class UpsellServiceV2 {
    code: string;
    description: string;
    serviceType: string;
    ssrCode: string;
    status: 'included' | 'chargeable' | 'not_included';
    isIncluded: boolean;
    isChargeable: boolean;
    flightInfoIndex: string;
    paxType: 'ADT' | 'CHD' | 'INF' | string;
}

/**
 * One fare option (card). Same keys as a V11 search route (fare[0].OfferedFare, flightSegments,
 * baggage, ... and every TBO key as-is) + upsell details.
 * solutionId[0] is the UPSELL ResultIndex: send it to revalidate / fare rule / SSR / book.
 */
export class FareUpsellOptionV2 extends RouteV2 {
    fareFamily: { code: string; name: string };
    isUpsellAvailable: boolean;
    upsellInclusions: UpsellInclusionV2[];
    upsellServices: UpsellServiceV2[];
}

export class FareUpsellV2Response {
    error: boolean;
    message: string;
    mode: string;
    trackingId: string;
    searchReqId: string;
    count: number;
    options: FareUpsellOptionV2[];
    [tboKey: string]: unknown;
}
