import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { TboAuthTokenService } from './tbo-auth-token.service';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { GenericRepo } from 'src/shared/utilities/flight/generic-repo.utility';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import { CalendarFareResponse } from '../../calendar-fare/interfaces/calendar-fare.interface';
import { redactTboCredentialsForLog } from 'src/shared/utilities/flight/tbo-request-context.utility';

@Injectable()
export class TboCalendarFareService {
    constructor(
        private readonly tboAuthTokenService: TboAuthTokenService,
        private readonly genericRepo: GenericRepo,
    ) {}

    /** [@Description: This method is used to fetch the calendar fare of the month]
     * @author: Prashant Joshi at 13-08-2026 **/
    async calendarFare(calendarFareRequest): Promise<CalendarFareResponse> {
        const { providerCred, calendarFareReqId } = calendarFareRequest;
        console.log(`CalendarFare [${calendarFareReqId}] - Payload received from aggregator:::::::::::`, JSON.stringify(calendarFareRequest.calendarFareReq, null, 2));
        console.log(`CalendarFare [${calendarFareReqId}] - Provider credentials (password redacted):::::::::::`, JSON.stringify(redactTboCredentialsForLog(providerCred), null, 2));

        const authToken = await this.tboAuthTokenService.getAuthToken(calendarFareRequest);
        calendarFareRequest.authToken = authToken;
        console.log(`CalendarFare [${calendarFareReqId}] - TBO auth token:::::::::::`, authToken);

        let endpoint = '';
        try {
            const requestBody = this.creatingCalendarFareRequest(calendarFareRequest);
            console.log(`CalendarFare [${calendarFareReqId}] - Payload sent to TBO:::::::::::`, JSON.stringify(requestBody, null, 2));

            // dev endpoint
            endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/GetCalendarFare`;

            // prod endpoint is
            // const endpoint = `${providerCred.url}/rest/GetCalendarFare`;

            console.log(`CalendarFare [${calendarFareReqId}] - Calling TBO URL:::::::::::`, `POST ${endpoint}`);
            const tboCallStartedAt = Date.now();
            const calendarFareResult = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestBody), 'other');
            console.log(`CalendarFare [${calendarFareReqId}] - TBO responded in ${Date.now() - tboCallStartedAt} ms`);
            console.log(`CalendarFare [${calendarFareReqId}] - Raw response from TBO:::::::::::`, JSON.stringify(calendarFareResult, null, 2));
            this.logFareSummary(calendarFareReqId, calendarFareResult);

            if (process.env.ENABLE_LOCAL_LOGS === 'true') {
                Generic.generateLogFile(
                    calendarFareReqId + '-TBO',
                    {
                        ApiRequest: calendarFareRequest.calendarFareReq,
                        supplierRequest: requestBody,
                        supplierResponse: calendarFareResult,
                    },
                    'calendarFare',
                );
            }

            return this.convertingResponse(calendarFareRequest, calendarFareResult);
        } catch (error) {
            await this.genericRepo.storeLogs(calendarFareReqId, 1, error, 0);
            console.log(`CalendarFare [${calendarFareReqId}] - TBO call failed for URL:::::::::::`, endpoint);
            console.log(`CalendarFare [${calendarFareReqId}] - TBO error status:::::::::::`, error?.response?.status);
            console.log(`CalendarFare [${calendarFareReqId}] - TBO error body:::::::::::`, JSON.stringify(error?.response?.data, null, 2));
            console.log(error);
            throw new InternalServerErrorException('There is an issue while fetching data from the providers.');
        }
    }

    /** [@Description: Logs one line per day (date, fare, airline) so a flat price across days is easy to spot] */
    logFareSummary(calendarFareReqId: string, results) {
        const responseNode = results?.Response ?? results;
        const searchResults = responseNode?.SearchResults ?? [];
        const rows = searchResults.map((r) => ({
            date: r?.DepartureDate,
            fare: r?.Fare,
            baseFare: r?.BaseFare,
            tax: r?.Tax,
            airline: r?.AirlineCode,
            isLowestFareOfMonth: r?.IsLowestFareOfMonth,
        }));
        const distinctFares = new Set(rows.map((r) => r.fare));
        console.log(
            `CalendarFare [${calendarFareReqId}] - Fare summary: ResponseStatus=${responseNode?.ResponseStatus}, TraceId=${responseNode?.TraceId}, days=${rows.length}, distinctFares=${distinctFares.size}`,
        );
        console.table(rows);
    }

    /** [@Description: This method is used to create the calendar fare request]
     * @author: Prashant Joshi at 13-08-2026 **/
    creatingCalendarFareRequest(calendarFareRequest) {
        const { calendarFareReq, headers, authToken } = calendarFareRequest;

        const params = {
            EndUserIp: headers['ip-address'],
            TokenId: authToken,
            JourneyType: '1',
            PreferredAirlines: calendarFareReq.preferredAirlines?.length ? calendarFareReq.preferredAirlines : null,
            Segments: [
                {
                    Origin: calendarFareReq.origin,
                    Destination: calendarFareReq.destination,
                    FlightCabinClass: Generic.convertCabinClassCode('TBO', calendarFareReq.cabinClass, true),
                    PreferredDepartureTime: `${calendarFareReq.preferredDepartureDate}T00:00:00`,
                },
            ],
            Sources: calendarFareReq.sources?.length ? calendarFareReq.sources : null,
        };

        return params;
    }

    /** [@Description: This method is used to convert the response]
     * @author: Prashant Joshi at 13-08-2026 **/
    convertingResponse(calendarFareRequest, results): CalendarFareResponse {
        const { providerCred, calendarFareReq } = calendarFareRequest;
        const calendarFareResponse: CalendarFareResponse = new CalendarFareResponse();

        /* TBO wraps Search/FareQuote replies under a `Response` node even though the
         * GetCalendarFare doc table doesn't show that envelope explicitly - handle both
         * shapes so we don't silently misread a wrapped reply as "no fare found". */
        const isWrapped = results?.Response !== undefined;
        const responseNode = isWrapped ? results.Response : results;
        console.log('CalendarFare - Response shape detected:::::::::::', isWrapped ? 'wrapped under Response' : 'flat');

        if (responseNode?.ResponseStatus === 1 && responseNode?.SearchResults?.length > 0) {
            calendarFareResponse.error = false;
            calendarFareResponse.message = 'OK';
            calendarFareResponse.mode = 'TBO-' + providerCred.mode;
            calendarFareResponse.trackingId = responseNode?.TraceId;
            calendarFareResponse.origin = responseNode?.Origin;
            calendarFareResponse.destination = responseNode?.Destination;
            calendarFareResponse.cabinClass = calendarFareReq.cabinClass;
            /* Untouched pass-through - whatever fields/casing TBO actually sends. */
            calendarFareResponse.searchResults = responseNode.SearchResults;
        } else {
            calendarFareResponse.error = true;
            calendarFareResponse.message = responseNode?.Error?.ErrorMessage || 'No calendar fare found.';
            calendarFareResponse.mode = 'TBO-' + providerCred.mode;
            calendarFareResponse.trackingId = responseNode?.TraceId;
            calendarFareResponse.origin = responseNode?.Origin || calendarFareReq.origin;
            calendarFareResponse.destination = responseNode?.Destination || calendarFareReq.destination;
            calendarFareResponse.cabinClass = calendarFareReq.cabinClass;
            calendarFareResponse.searchResults = [];
        }

        return calendarFareResponse;
    }
}
