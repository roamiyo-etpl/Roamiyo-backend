import { Injectable, HttpException } from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';

@Injectable()
export class SsrService {
  async flightSeatMapping(data: any, headers: any) {
    try {
      console.log("payload::::::::::", data);

      const agent = new https.Agent({
        rejectUnauthorized: false,
      });

      const response = await axios.post(
        `https://tboapi.travelboutiqueonline.com/AirAPI_V10/AirService.svc/rest/SSR`,
        data,
        {
          timeout: 60000,
          httpsAgent: agent,
          headers: {
            "Ip-Address": headers['ip-address'] || data.EndUserIp,
            "Content-Type": "application/json",
          },
        }
      );

      const tboData = response.data;

      if (tboData?.Response?.ResponseStatus !== 1) {
        throw new HttpException(
          tboData?.Response?.Error?.ErrorMessage || "TBO SSR Failed",
          500
        );
      }

      const result = tboData.Response;

      // ✅ BAGGAGE
      const baggage = (result.Baggage || []).flat().map((item: any) => ({
        airline: item.AirlineCode,
        flightNumber: item.FlightNumber,
        weight: item.Weight,
        price: item.Price,
        origin: item.Origin,
        destination: item.Destination,
      }));

      // ✅ MEALS
      const meals = (result.MealDynamic || []).flat().map((item: any) => ({
        airline: item.AirlineCode,
        flightNumber: item.FlightNumber,
        code: item.Code,
        description: item.AirlineDescription,
        price: item.Price,
        origin: item.Origin,
        destination: item.Destination,
      }));

      // ✅ SEATS
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
      console.error("Seat Mapping Error:", error?.response?.data || error.message);
      throw new HttpException(error.message, 500);
    }
  }
}