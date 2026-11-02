/** One cancellation / reissue fee row, flattened from TBO V11 MiniFareRules (one row per pax type) */
export class MiniFareRuleV2 {
    journeyDirection: 'outbound' | 'inbound';
    solutionId: string;
    origin: string;
    destination: string;
    airline: string;
    fareBasisCode: string;
    /** TBO Type 0 = Cancellation (refund), 1 = Reissue (date change) */
    type: 'Cancellation' | 'Reissue' | string;
    typeCode: number | string;
    /** e.g. "Before Departure", "NoShow" */
    departureType: string;
    /** Time before departure the window covers, TBO timespan as-is: "04:00:00", "13.18:00:00" */
    fromDuration: string;
    toDuration: string;
    fromHours: number | null;
    toHours: number | null;
    /** e.g. "4h to 13d 18h" */
    window: string;
    paxType: 'ADT' | 'CHD' | 'INF' | string;
    airlineFee: number | null;
    currency: string;
}

/** TBO FareRule V11 result for one solutionId. Every TBO response key is passed as-is */
export class FareRuleV2Result {
    journeyDirection: 'outbound' | 'inbound';
    solutionId: string;
    error: boolean;
    message: string;
    miniFareRules: MiniFareRuleV2[];
    [tboKey: string]: unknown;
}

export class FareRuleV2Response {
    error: boolean;
    message: string;
    mode: string;
    trackingId: string;
    searchReqId: string;
    /** All solutionIds' rows together (outbound first) */
    miniFareRules: MiniFareRuleV2[];
    /** TBO FareRules[] of all solutionIds, raw */
    fareRules: unknown[];
    results: FareRuleV2Result[];
}
