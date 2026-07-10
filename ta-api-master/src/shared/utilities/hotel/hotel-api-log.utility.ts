/** Hotel API console logging — client TravelTek routes and outbound TBO URLs. */

export type HotelTboFlow =
    | 'auth'
    | 'search'
    | 'room-list'
    | 'room-quote'
    | 'book-initiate-prebook'
    | 'book-confirmation'
    | 'get-booking-detail'
    | 'order-detail'
    | 'cancel-send-change'
    | 'cancel-change-status';

const CLIENT_TBO_HINT: Record<string, string> = {
    '/hotel/search/initiate': 'TBO → Auth (if needed), Search',
    '/hotel/search/check-results': 'no TBO call (cache)',
    '/hotel/search/filtration': 'no TBO call (cache)',
    '/hotel/room/list': 'TBO → Search',
    '/hotel/room/quote': 'TBO → PreBook',
    '/hotel/book/initiate': 'TBO → PreBook',
    '/hotel/book/confirmation': 'TBO → Auth, Book, Getbookingdetail',
    '/hotel/book/booking-details': 'no TBO call (DB)',
    '/hotel/order-detail': 'TBO → Auth, Getbookingdetail',
};

/** Log when a client hits a TravelTek hotel API. */
export function logHotelClientRequest(params: {
    method: string;
    fullUrl: string;
    apiPath: string;
}): void {
    const { method, fullUrl, apiPath } = params;
    const normalizedPath = normalizeHotelApiPath(apiPath);
    const tboHint = resolveClientTboHint(normalizedPath);

    console.log(
        `[HOTEL-API][CLIENT] ${method.toUpperCase()} ${fullUrl} | endpoint=${normalizedPath}${tboHint ? ` | ${tboHint}` : ''}`,
    );
}

/** Log before an outbound TBO hotel HTTP call. */
export function logHotelTboRequest(params: {
    method: string;
    endpoint: string;
    flow: HotelTboFlow | string;
}): void {
    const { method, endpoint, flow } = params;
    const apiSegment = extractTboApiSegment(endpoint);

    console.log(
        `[HOTEL-API][TBO] ${method.toUpperCase()} ${endpoint} | flow=${flow} | tbo-api=${apiSegment}`,
    );
}

function normalizeHotelApiPath(path: string): string {
    const withoutQuery = path.split('?')[0] ?? path;
    if (withoutQuery.startsWith('/hotel/book/booking-details/')) {
        return '/hotel/book/booking-details/:bookingRefId';
    }
    return withoutQuery;
}

function resolveClientTboHint(apiPath: string): string | null {
    const exact = CLIENT_TBO_HINT[apiPath];
    if (exact) {
        return exact;
    }
    if (apiPath.startsWith('/hotel/book/booking-details/')) {
        return CLIENT_TBO_HINT['/hotel/book/booking-details'];
    }
    return null;
}

function extractTboApiSegment(endpoint: string): string {
    try {
        const pathname = new URL(endpoint).pathname;
        const segments = pathname.split('/').filter(Boolean);
        return segments[segments.length - 1] ?? endpoint;
    } catch {
        const segments = endpoint.split('/').filter(Boolean);
        return segments[segments.length - 1] ?? endpoint;
    }
}
