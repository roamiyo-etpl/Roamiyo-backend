import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { TboAuthTokenService } from './tbo-auth-token.service';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { GenericRepo } from 'src/shared/utilities/flight/generic-repo.utility';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import { CalendarFareResponse } from '../../calendar-fare/interfaces/calendar-fare.interface';

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
        console.log('CalendarFare - Payload received from aggregator:::::::::::', JSON.stringify(calendarFareRequest.calendarFareReq));

        const authToken = await this.tboAuthTokenService.getAuthToken(calendarFareRequest);
        calendarFareRequest.authToken = authToken;

        try {
            const requestBody = this.creatingCalendarFareRequest(calendarFareRequest);
            console.log('CalendarFare - Payload sent to TBO:::::::::::', JSON.stringify(requestBody));

            // dev endpoint
            const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/GetCalendarFare`;

            // prod endpoint is
            // const endpoint = `${providerCred.url}/rest/GetCalendarFare`;

            const calendarFareResult = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestBody), 'other');
            console.log('CalendarFare - Raw response from TBO:::::::::::', JSON.stringify(calendarFareResult));

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
            console.log(error);
            throw new InternalServerErrorException('There is an issue while fetching data from the providers.');
        }
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
