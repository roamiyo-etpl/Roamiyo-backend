import { Route, StartRoutingResponse } from '../../search/interfaces/start-routing.interface';

/** A V11 search result. Same keys as v1 Route + every key TBO sends on the result (TBO names) */
export class RouteV2 extends Route {
    /** outbound = Results[0] (oneway, international return, multi-city, domestic return OB),
     * inbound = Results[1] (domestic return IB) */
    journeyDirection: 'outbound' | 'inbound';
    [tboKey: string]: unknown;
}

/** V11 search response. Every top-level key of TBO's Response (except Results) is also passed as-is */
export class StartRoutingV2Response extends StartRoutingResponse {
    declare route: RouteV2[];
    /** Domestic return only: inbound (IB) results, not paired with outbound. Client picks one OB + one IB */
    inboundRoute: RouteV2[];
    [tboKey: string]: unknown;
}
