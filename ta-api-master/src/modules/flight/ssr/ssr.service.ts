import { Injectable, HttpException } from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';
import { SsrCacheService } from './ssr-cache.service';
import { flightBookingDebug } from 'src/shared/utilities/flight/flight-booking-logger.utility';
import {
  classifyTboApiOutcome,
  logTboApiCallEnd,
  logTboApiCallStart,
  tryExtractTraceIdFromPayload,
} from 'src/shared/utilities/flight/tbo-api-instrumentation.utility';

@Injectable()
export class SsrService {
  constructor(private readonly ssrCacheService: SsrCacheService) {}

  async flightSeatMapping(data: any, headers: any) {
    try {
      flightBookingDebug('SSR seat-map request', {
        traceId: data?.TraceId,
        resultIndex: data?.ResultIndex,
      });

      const agent = new https.Agent({
        rejectUnauthorized: false,
      });

      const endpoint =
        'https://tboapi.travelboutiqueonline.com/AirAPI_V10/AirService.svc/rest/SSR';
      const traceId = tryExtractTraceIdFromPayload(data);
      const startMs = Date.now();
      logTboApiCallStart({
        apiName: 'SSR',
        phase: 'ssr',
        traceId,
        method: 'POST',
      });

      let response;
      try {
        response = await axios.post(endpoint, data, {
          timeout: 60000,
          httpsAgent: agent,
          headers: {
            'Ip-Address': headers['ip-address'] || data.EndUserIp,
            'Content-Type': 'application/json',
          },
        });
      } catch (error: any) {
        logTboApiCallEnd({
          apiName: 'SSR',
          phase: 'ssr',
          traceId,
          method: 'POST',
          durationMs: Date.now() - startMs,
          success: false,
          message: error?.response?.data?.Response?.Error?.ErrorMessage ?? error?.message,
          httpStatus: error?.response?.status,
        });
        throw error;
      }

      const tboData = response.data;
      const outcome = classifyTboApiOutcome(tboData);
      logTboApiCallEnd({
        apiName: 'SSR',
        phase: 'ssr',
        traceId: traceId ?? tboData?.Response?.TraceId,
        method: 'POST',
        durationMs: Date.now() - startMs,
        success: outcome.success,
        responseStatus: outcome.responseStatus,
        message: outcome.message,
        httpStatus: response.status,
      });

      if (tboData?.Response?.ResponseStatus !== 1) {
        throw new HttpException(
          tboData?.Response?.Error?.ErrorMessage || 'TBO SSR Failed',
          500,
        );
      }

      await this.ssrCacheService.saveSsrResponse({
        traceId: data?.TraceId ?? tboData.Response?.TraceId,
        resultIndex: data?.ResultIndex,
        response: tboData,
      });

      const result = tboData.Response;

      const baggage = (result.Baggage || []).flat().map((item: any) => ({
        airline: item.AirlineCode,
        flightNumber: item.FlightNumber,
        weight: item.Weight,
        price: item.Price,
        origin: item.Origin,
        destination: item.Destination,
      }));

      const meals = (result.MealDynamic || []).flat().map((item: any) => ({
        airline: item.AirlineCode,
        flightNumber: item.FlightNumber,
        code: item.Code,
        description: item.AirlineDescription,
        price: item.Price,
        origin: item.Origin,
        destination: item.Destination,
      }));

      const seats: any[] = [];

      (result.SeatDynamic || []).forEach((segment: any) => {
        (segment.SegmentSeat || []).forEach((segSeat: any) => {
          (segSeat.RowSeats || []).forEach((row: any) => {
            (row.Seats || []).forEach((seat: any) => {
              if (!seat.SeatNo) return;

              seats.push({
                airline: seat.AirlineCode,
                flightNumber: seat.FlightNumber,
                origin: seat.Origin,
                destination: seat.Destination,
                row: seat.RowNo,
                seatNo: seat.SeatNo,
                code: seat.Code,
                price: seat.Price,
                currency: seat.Currency,
                availability: seat.AvailablityType,
                seatType: seat.SeatType,
              });
            });
          });
        });
      });

      return {
        traceId: result.TraceId,
        baggage,
        meals,
        seats,
        seatCount: seats.length,
        baggageCount: baggage.length,
        mealCount: meals.length,
        tboResponse: result,
      };
    } catch (error: any) {
      throw new HttpException(error.message, 500);
    }
  }
}
