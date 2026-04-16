import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ProviderRoomsService } from '../providers/providers-rooms.service';
import { HotelRoomResponse } from './interfaces/room-list-response.interface';
import { HotelRoomListRequestDto } from './dtos/hotel-room-list.dto';
import { HotelRoomQuoteDto } from './dtos/hotel-room-quote.dto';
import { HotelRoomQuoteResponse } from './interfaces/room-quote-response.interface';
import { v4 as uuidv4 } from 'uuid';
import { SupplierCredService } from 'src/modules/generic/supplier-credientials/supplier-cred.service';

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
                throw new BadRequestException('ERR_ADULT_SHOULD_BE_ONE');
            }
            /* Check active provider details */
            const providersData = await this.supplierCred.getActiveProviders(headers);

            /* setting up only provider config in the response */
            const activeProviders: any[] = providersData.map((data) => ({
                providerId: data.provider_id,
                code: data.code,
                assignedId: data.provider_id, // Using provider_id as assignedId for now
                providerCredentials: data.provider_credentials,
            }));

            Object.assign(apiReqData, { activeProviders: activeProviders });
            // apiReqData['searchReqId'] = uuidv4();
            return await this.providerRoomsService.searchRoom(apiReqData, headers);
        } catch (error) {
            this.logger.error('Hotel Room List failed:', error);
            throw new Error(`Hotel Room List failed: ${error.message}`);
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
                throw new BadRequestException("RateKey can't be null");
            }
            /* Check active provider details */
            const providersData = await this.supplierCred.getActiveProviders(headers);
            /* setting up only provider config in the response */
            const activeProviders: any[] = providersData.map((data) => ({
                providerId: data.provider_id,
                code: data.code,
                assignedId: data.provider_id, // Using provider_id as assignedId for now
                providerCredentials: data.provider_credentials,
            }));
            Object.assign(hotelRoomQuoteDto, { activeProviders: activeProviders });
            return await this.providerRoomsService.searchRoomQuote(hotelRoomQuoteDto, headers);
        } catch (error) {
            this.logger.error('Hotel Room Quote failed:', error);
            throw new Error(`Hotel Room Quote failed: ${error.message}`);
        }
    }
}
