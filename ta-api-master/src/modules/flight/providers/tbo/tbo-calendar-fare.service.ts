import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { TboAuthTokenService } from './tbo-auth-token.service';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { GenericRepo } from 'src/shared/utilities/flight/generic-repo.utility';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import { airlines } from 'src/shared/utilities/flight/airline.utility';
import { CalendarFareResponse, CalendarFareResult } from '../../calendar-fare/interfaces/calendar-fare.interface';

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
        const authToken = await this.tboAuthTokenService.getAuthToken(calendarFareRequest);
        calendarFareRequest.authToken = authToken;

        try {
            const requestBody = this.creatingCalendarFareRequest(calendarFareRequest);

            // dev endpoint
            const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/GetCalendarFare`;

            // prod endpoint is
            // const endpoint = `${providerCred.url}/rest/GetCalendarFare`;

            const calendarFareResult = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestBody), 'other');

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

        if (results?.ResponseStatus === 1 && results?.SearchResults?.length > 0) {
            const searchResults: CalendarFareResult[] = results.SearchResults.map((result) => {
                const fareResult = new CalendarFareResult();
                fareResult.airlineCode = result?.AirlineCode;
                fareResult.airlineName = result?.AirlineName || airlines('')[result?.AirlineCode] || result?.AirlineCode;
                fareResult.departureTime = result?.DepartureTime;
                fareResult.isLowestFareOfMonth = result?.IsLowestFareOfMonth;
                fareResult.baseFare = result?.BaseFare;
                fareResult.tax = result?.Tax;
                fareResult.yqTax = result?.YQTax;
                fareResult.otherCharge = result?.OtherCharge;
                return fareResult;
            });

            calendarFareResponse.error = false;
            calendarFareResponse.message = 'OK';
            calendarFareResponse.mode = 'TBO-' + providerCred.mode;
            calendarFareResponse.trackingId = results?.TraceId;
            calendarFareResponse.origin = results?.Origin;
            calendarFareResponse.destination = results?.Destination;
            calendarFareResponse.cabinClass = calendarFareReq.cabinClass;
            calendarFareResponse.searchResults = searchResults;
        } else {
            calendarFareResponse.error = true;
            calendarFareResponse.message = results?.Error?.ErrorMessage || 'No calendar fare found.';
            calendarFareResponse.mode = 'TBO-' + providerCred.mode;
            calendarFareResponse.trackingId = results?.TraceId;
            calendarFareResponse.origin = results?.Origin || calendarFareReq.origin;
            calendarFareResponse.destination = results?.Destination || calendarFareReq.destination;
            calendarFareResponse.cabinClass = calendarFareReq.cabinClass;
            calendarFareResponse.searchResults = [];
        }

        return calendarFareResponse;
    }
}
