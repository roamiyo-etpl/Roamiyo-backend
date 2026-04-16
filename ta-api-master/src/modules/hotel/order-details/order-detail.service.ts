import { Injectable, Logger } from '@nestjs/common';
import { ProviderOrderDetailService } from '../providers/provider-order-detail.service';
import { SupplierCredService } from 'src/modules/generic/supplier-credientials/supplier-cred.service';
import { Generic } from 'src/shared/utilities/flight/generic.utility';



@Injectable()
export class HotelOrderDetailService {
  private readonly logger = new Logger(HotelOrderDetailService.name);
  constructor(
    private readonly providerOrderDetailService: ProviderOrderDetailService,
    private supplierCred: SupplierCredService,
  ) { }

  /** [@Description: This method is used to get the order details]
   * @author: Prashant Joshi at 23-09-2025 **/
  async getOrderDetails(orderReq: any, headers: Headers): Promise<any> {

    try {

      /* Check active provider details */
      const providersData = await this.supplierCred.getActiveProviders(headers);

      /* setting up only provider config in the response */
      const activeProviders: any[] = providersData.map((data) => ({
        providerId: data.provider_id,
        code: data.code,
        assignedId: data.provider_id, // Using provider_id as assignedId for now
        providerCredentials: data.provider_credentials,
      }));

      Object.assign(orderReq, { activeProviders: activeProviders });
      const response = await this.providerOrderDetailService.orderDetail(orderReq, headers);
      // console.log(response, "response");
      const getBookingResponse = this.convertBookingResponse(response.bookDetailsResponse)
      return {
        success: true,
        ...getBookingResponse
      };
    } catch (error) {
      this.logger.error('Hotel Order Detail failed:', error);
      throw new Error(`Hotel Order Detail failed: ${error.message}`);
    }
  }

  /**
     * Convert Tbo response in hotel standard response
     * @param apiResponse - Check-in date
     * @returns convert response
  */   
  private convertBookingResponse(apiResponse) {
    // Basic booking info
    const booking = {
      bookingId: apiResponse.BookingId,
      bookingReferenceId: apiResponse.BookingRefNo,
      supplierBookingId: apiResponse.BookingId,
      status: apiResponse.HotelBookingStatus || "Unknown",
      remarks: apiResponse.AgentRemarks || "",
      bookingDate: apiResponse.BookingDate,
      hotel: {
        hotelId: apiResponse.TBOHotelCode || "",
        name: apiResponse.HotelName,
        rating: apiResponse.StarRating,
        address: `${apiResponse.AddressLine1 || ""} ${apiResponse.AddressLine2 || ""}`.trim(),
        phones: [],
        location:{
          geoLocation:{
             latitude: apiResponse.Latitude,
             longitude: apiResponse.Longitude,
          },
          city: apiResponse.City,
          state: apiResponse.State|| '',
          country: apiResponse.country || '',
          countryCode: apiResponse.CountryCode,
        },
        description: apiResponse.description,
        images: apiResponse.images || []       
      },
      stayDetails: {
        checkIn: apiResponse.CheckInDate,
        checkOut: apiResponse.CheckOutDate,
        noOfRooms: apiResponse.NoOfRooms,
        nights: this.calculateNights(apiResponse.CheckInDate, apiResponse.CheckOutDate),
      },
      prices: {
        // selling: Generic.currencyConversion(NetAmount, providerCurrency, preferredCurrency) || 0,
        selling: Generic.currencyConversion(apiResponse.NetAmount, 'INR', 'INR') || 0,
        // currency: preferredCurrency,
        currency: 'INR',
        taxIncluded: true,
        // taxes: totalTax,
        // taxes: Generic.currencyConversion(NetTax, providerCurrency, preferredCurrency) || 0,
        taxes: Generic.currencyConversion(apiResponse.NetTax, 'INR', 'INR') || 0,
        // priceHash: `TBO_${apiResponse.TBOHotelCode}_${NetAmount}_${NetTax}_${searchReqId}`,
        priceHash: `TBO_${apiResponse.TBOHotelCode}_${apiResponse.NetAmount}_${apiResponse.NetTax}_hjahjd6363`,

      },
      rooms: [] as any[],
      termsCancellationPolicy: apiResponse.Rooms[0].CancellationPolicy || null,
    };

    // Loop through rooms
    if (apiResponse.Rooms && Array.isArray(apiResponse.Rooms)) {
      apiResponse.Rooms.forEach(room => {
        const roomObj = {
          roomName: room.RoomTypeName,
          roomDescription: room.RoomDescription,
          adultCount: room.AdultCount,
          childCount: room.ChildCount || 0,
          childAges: room.ChildAge || [],
          // guests: [] as any[],
          inclusion: room.Inclusion || "",
          // price: {
          //   currency: room.PriceBreakUp?.CurrencyCode || "INR",
          //   baseRate: room.PriceBreakUp?.RoomRate || 0,
          //   tax: room.PriceBreakUp?.RoomTax || 0,
          //   totalAmount: (room.PriceBreakUp?.RoomRate || 0) + (room.PriceBreakUp?.RoomTax || 0)
          // },
          cancellationPolicy: room.CancelPolicies|| []
        };

        // Guests per room
        // if (room.HotelPassenger && Array.isArray(room.HotelPassenger)) {
        //   room.HotelPassenger.forEach(pax => {
        //     roomObj.guests.push({
        //       title: pax.Title,
        //       firstName: pax.FirstName,
        //       middleName: pax.MiddleName,
        //       lastName: pax.LastName,
        //       email: pax.Email || null,
        //       phone: pax.Phoneno || null,
        //       leadPassenger: pax.LeadPassenger,
        //       age: pax.Age,
        //       fileDocument: pax.FileDocument,
        //       paxType: pax.PaxType,
        //       phoneno: pax.Phoneno,
        //       pan: pax.PAN,
        //       passportExpDate: pax.PassportExpDate,
        //       passportIssueDate: pax.PassportIssueDate,
        //       passportNo: pax.PassportNo,
        //     });
        //   });
        // }

        // Cancellation policies
        //   if (room.CancelPolicies && Array.isArray(room.CancelPolicies)) {
        //     room.CancelPolicies.forEach(policy => {
        //       roomObj.cancellationPolicy.push({
        //         from: policy.FromDate,
        //         to: policy.ToDate,
        //         charge: policy.CancellationCharge,
        //         chargeType: policy.ChargeType
        //       });
        //     });
        //   }

        booking.rooms.push(roomObj);
      });
    }

    return booking;
  }

    /**
     * Calculate number of nights between check-in and check-out
     * @param checkIn - Check-in date
     * @param checkOut - Check-out date
     * @returns number - Number of nights
     */
    private calculateNights(checkIn: string, checkOut: string): number {
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const diffTime = checkOutDate.getTime() - checkInDate.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

}