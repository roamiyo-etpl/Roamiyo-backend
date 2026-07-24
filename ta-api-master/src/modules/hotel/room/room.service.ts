import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ProviderRoomsService } from '../providers/providers-rooms.service';
import { HotelRoomResponse } from './interfaces/room-list-response.interface';
import { HotelRoomListRequestDto } from './dtos/hotel-room-list.dto';
import { HotelRoomQuoteDto } from './dtos/hotel-room-quote.dto';
import { HotelRoomQuoteResponse } from './interfaces/room-quote-response.interface';
import { SupplierCredService } from 'src/modules/generic/supplier-credientials/supplier-cred.service';
import { HotelProviderUtility } from 'src/shared/utilities/hotel/hotel-provider.utility';
import { throwHotelApiError } from 'src/shared/utilities/hotel/hotel-error.utility';

@Injectable()
export class HotelRoomService {
    private readonly logger = new Logger(HotelRoomService.name);
    constructor(
        private readonly providerRoomsService: ProviderRoomsService,
        private supplierCred: SupplierCredService,
    ) {}

    /**
     * Hotel Room Details across multiple providers
     * @author Prashant - Updated following dmc-api-backend pattern
     * @param apiReqData - Hotel Room Details request
     * @param headers - Headers
     * @returns Hotel Room Details response
     */
    async getHotelRoomList(apiReqData: HotelRoomListRequestDto, headers: Headers): Promise<HotelRoomResponse> {
        try {
            /* Search request validations */
            if (!apiReqData.rooms.some((room) => room.adults >= 1)) {
                throw new BadRequestException({
                    success: false,
                    message: 'At least one adult is required in the room occupancy',
                });
            }
            /* Check active provider details */
            const providersData = await this.supplierCred.getActiveProviders(headers);

            const activeProviders = HotelProviderUtility.mapActiveProviders(providersData);

            Object.assign(apiReqData, { activeProviders: activeProviders });
            const roomResponse = await this.providerRoomsService.searchRoom(apiReqData, headers);
            return { ...roomResponse, mode: roomResponse.mode || HotelProviderUtility.resolveResponseMode(activeProviders) };
        } catch (error) {
            this.logger.error('Hotel Room List failed:', error);
            throwHotelApiError(error, 'Hotel room list failed');
        }
    }

    /**
     * Hotel Room Quote across multiple providers
     * @author Prashant - Updated following dmc-api-backend pattern
     * @param hotelRoomQuoteDto - Hotel Room Quote request
     * @param headers - Headers
     * @returns Hotel Room Quote response
     */
    async getHotelRoomQuote(hotelRoomQuoteDto: HotelRoomQuoteDto, headers): Promise<HotelRoomQuoteResponse> {
        try {
            /* Search request validations */
            if (!hotelRoomQuoteDto.roomBookingInfo[0].rateKey) {
                throw new BadRequestException({
                    success: false,
                    message: 'Rate key is required',
                });
            }
            /* Check active provider details */
            const providersData = await this.supplierCred.getActiveProviders(headers);
            const activeProviders = HotelProviderUtility.mapActiveProviders(providersData);
            Object.assign(hotelRoomQuoteDto, { activeProviders: activeProviders });
            const roomQuoteResponse = await this.providerRoomsService.searchRoomQuote(hotelRoomQuoteDto, headers);
            return { ...roomQuoteResponse, mode: roomQuoteResponse.mode || HotelProviderUtility.resolveResponseMode(activeProviders) };
        } catch (error) {
            this.logger.error('Hotel Room Quote failed:', error);
            throwHotelApiError(error, 'Hotel room quote failed');
        }
    }
}
