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

function groupByFlight(segments: any, baggage: any[], meals: any[], seats: any[]) {
  const fnKey = (n: unknown) => String(n ?? '').trim();

  const build = (segmentList: any[]) => {
    return segmentList.map((seg) => ({
      flightNumber: seg.flightNumber,
      origin: seg.origin,
      destination: seg.destination,

      baggage: baggage.filter(
        (b) =>
          fnKey(b.flightNumber) === fnKey(seg.flightNumber) &&
          fnKey(b.origin) === fnKey(seg.origin) &&
          fnKey(b.destination) === fnKey(seg.destination),
      ),

      meals: meals.filter(
        (m) =>
          fnKey(m.flightNumber) === fnKey(seg.flightNumber) &&
          fnKey(m.origin) === fnKey(seg.origin) &&
          fnKey(m.destination) === fnKey(seg.destination),
      ),

      seats: seats.filter(
        (s) =>
          fnKey(s.flightNumber) === fnKey(seg.flightNumber) &&
          fnKey(s.origin) === fnKey(seg.origin) &&
          fnKey(s.destination) === fnKey(seg.destination),
      ),
    }));
  };

  return {
    outbound: build(segments.outbound || []),
    inbound: build(segments.inbound || []),
  };
}

@Injectable()
export class SsrService {
  constructor(private readonly ssrCacheService: SsrCacheService) {}

  async flightGroupedSeatMap(data: any, headers: any) {
    try {
      console.log('payload::::::::::', JSON.stringify(data, null, 2));

      const agent = new https.Agent({
        rejectUnauthorized: false,
      });

      // =========================================
      // ✅ SUPPORT SINGLE + MULTIPLE RESULT INDEX
      // =========================================

      const resultIndexes = data.ResultIndex.includes('|||')
        ? data.ResultIndex.split('|||').map((r: string) => r.trim())
        : [data.ResultIndex];

      console.log('SSR ResultIndexes::::::::::', resultIndexes);

      // =========================================
      // ✅ CALL TBO SSR API
      // =========================================

      const ssrResponses = await Promise.all(
        resultIndexes.map(async (resultIndex: string) => {
          const payload = {
            ...data,
            ResultIndex: resultIndex,
          };

          console.log('SSR Payload::::::::::', JSON.stringify(payload, null, 2));

          const response = await axios.post(
            'http://api.tektravels.com/BookingEngineService_Air/AirService.svc/rest/SSR',
            payload,
            {
              timeout: 60000,
              httpsAgent: agent,
              headers: {
                'Ip-Address': headers['ip-address'] || data.EndUserIp,
                'Content-Type': 'application/json',
              },
            },
          );

          return response.data;
        }),
      );

      // =========================================
      // ✅ VALIDATE RESPONSES
      // =========================================

      ssrResponses.forEach((tboData: any) => {
        if (tboData?.Response?.ResponseStatus !== 1) {
          throw new HttpException(
            tboData?.Response?.Error?.ErrorMessage || 'TBO SSR Failed',
            500,
          );
        }
      });

      // =========================================
      // ✅ MERGE ALL RESPONSES
      // =========================================

      const results = ssrResponses.map((r: any) => r.Response);

      // =========================================
      // ✅ BAGGAGE
      // =========================================

      const baggage = results.flatMap((result: any) =>
        (result.Baggage || []).flat().map((item: any) => ({
          airline: item.AirlineCode,
          flightNumber: item.FlightNumber,
          weight: item.Weight,
          price: item.Price,
          origin: item.Origin,
          destination: item.Destination,
        })),
      );

      // =========================================
      // ✅ MEALS
      // =========================================

      const meals = results.flatMap((result: any) =>
        (result.MealDynamic || []).flat().map((item: any) => ({
          airline: item.AirlineCode,
          flightNumber: item.FlightNumber,
          code: item.Code,
          description: item.AirlineDescription,
          price: item.Price,
          origin: item.Origin,
          destination: item.Destination,
        })),
      );

      // =========================================
      // ✅ SEATS
      // =========================================

      const seats: any[] = [];

      results.forEach((result: any) => {
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
      });

      // =========================================
      // ✅ GROUP SSR BY FLIGHT
      // =========================================

      const groupedSSR = groupByFlight(data.segments, baggage, meals, seats);

      const groupedArray: any[] = [];

      if (groupedSSR.outbound?.length) {
        groupedArray.push({
          type: 'outbound',
          flights: groupedSSR.outbound,
        });
      }

      if (groupedSSR.inbound?.length) {
        groupedArray.push({
          type: 'inbound',
          flights: groupedSSR.inbound,
        });
      }

      // =========================================
      // ✅ FINAL RESPONSE
      // =========================================

      return {
        traceId: results[0]?.TraceId,
        resultIndexes,
        ssr: groupedArray,
        baggageCount: baggage.length,
        mealCount: meals.length,
        seatCount: seats.length,
        tboResponse: results,
      };
    } catch (error: any) {
      console.error('Seat Mapping Error:', error?.response?.data || error.message);

      throw new HttpException(error.message, error.code || 500);
    }
  }

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
