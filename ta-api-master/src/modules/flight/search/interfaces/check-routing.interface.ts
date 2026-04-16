import { Filter, Route, TravelPreference } from './start-routing.interface';

export class CheckRoutingResponse {
    searchReqId: string;
    hashReqKey?: string;
    trackingId?: string;
    complete: boolean;
    message: string;
    mode: string;
    count?: number;
    route: Route[];
    filters?: Filter;
    travelPreferences?: TravelPreference;
}
