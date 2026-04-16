import { Injectable, InternalServerErrorException } from '@nestjs/common';

import { HotelRoomResponse } from '../room/interfaces/room-list-response.interface';
import { HotelRoomQuoteResponse } from '../room/interfaces/room-quote-response.interface';
import { TboRoomService } from './tbo/tbo-room.service';

@Injectable()
export class ProviderRoomsService {
    constructor(private readonly tboRoomService: TboRoomService) {}

    /**
     * Search rooms across multiple providers
     * @param roomReq - Room search request
     * @param headers - Request headers
     * @returns Promise<HotelRoomResponse> - Room search results
     */
    async searchRoom(roomReq, headers: Headers): Promise<HotelRoomResponse> {
        const { activeProviders } = roomReq;
        const roomRequest = [];
        roomRequest['searchReqId'] = roomReq['searchReqId'];

        try {
            const roomResults: Promise<HotelRoomResponse>[] = [];
            const activeProvidersName = activeProviders.map((data) => {
                const cred = JSON.parse(data.providerCredentials);
                return cred.provider;});

            const language = headers['language']?.toUpperCase() || 'en';
            Object.assign(roomReq, { currency: headers['currency-preference']?.toUpperCase() || 'USD' });
            Object.assign(roomReq, { language: language });

            /* Get Currency Rates */
            roomRequest['language'] = language;
            roomRequest['roomReq'] = roomReq;


            // console.log("activeProvidersName", activeProvidersName);

            /* For TBO */
            if (activeProvidersName.indexOf('TBO') !== -1) {
                // console.log('TBO found for room search');
                /* Filtering configuration with TBO only */
                const tboCred = activeProviders.filter((item) => {
                    // return item.providerCredentials.provider == 'TBO';
                    const cred = JSON.parse(item.providerCredentials);
                    return cred.provider== 'TBO';
                });
        

                if (tboCred.length > 0) {
                    roomRequest['providerCred'] = tboCred[0]?.providerCredentials;

                    const tboRoomResult = this.tboRoomService.searchRooms(roomReq, JSON.parse(tboCred[0]?.providerCredentials));
                    roomResults.push(tboRoomResult);
                }
            }

            /* For HOB (Hotelbeds) */
            if (activeProvidersName.indexOf('HOB') !== -1) {
                /* Filtering configuration with HOB only */
                const hobCred = activeProviders.filter((item) => {
                    return item.code == 'HOB';
                });

                if (hobCred.length > 0) {
                    roomRequest['assignedId'] = hobCred[0]?.assignedId;
                    roomRequest['providerCred'] = hobCred[0]?.providerCredentials;

                    // TODO: Implement Hotelbeds room service
                    // const hotelbedsRoomResult = this.hotelbedsRoomService.searchRooms(roomRequest);
                    // roomResults.push(hotelbedsRoomResult);
                }
            }

            /* Checking for first come response from the Providers */
            let result: HotelRoomResponse;
            try {
                if (roomResults.length === 0) {
                    throw new InternalServerErrorException('ERR_NO_ACTIVE_PROVIDERS');
                }
                result = await Promise.race(roomResults);
            } catch (error) {
                console.log('supplier room details error', error);
                throw new InternalServerErrorException('ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER');
            }
            const results: HotelRoomResponse = result;

            return results;
        } catch (error) {
            console.log('supplier room details error', error);
            throw new InternalServerErrorException('ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER');
        }
    }

    /**
     * Search room quote across multiple providers
     * @param roomQuoteReq - Room quote request
     * @param headers - Request headers
     * @returns Promise<HotelRoomQuoteResponse> - Room quote results
     */
    async searchRoomQuote(roomQuoteReq, headers: Headers): Promise<HotelRoomQuoteResponse> {
        const { activeProviders } = roomQuoteReq;
        const roomQuoteRequest = [];
        roomQuoteRequest['searchReqId'] = roomQuoteReq['searchReqId'];
        // console.log(activeProviders);

        try {
            const roomQuoteResults: Promise<HotelRoomQuoteResponse>[] = [];
            const activeProvidersName = activeProviders.map((data) => {
                const cred = JSON.parse(data.providerCredentials);
                return cred.provider;});

            const language = headers['language']?.toUpperCase() || 'en';
            Object.assign(roomQuoteReq, { currency: headers['currency-preference']?.toUpperCase() || 'USD' });
            Object.assign(roomQuoteReq, { language: language });

            /* Get Currency Rates */
            roomQuoteRequest['language'] = language;
            roomQuoteRequest['roomQuoteReq'] = roomQuoteReq;

            /* For TBO */
            if (activeProvidersName.indexOf('TBO') !== -1) {
                console.log('TBO found for room quote');
                /* Filtering configuration with TBO only */
                const tboCred = activeProviders.filter((item) => {
                    // return item.providerCredentials.provider == 'TBO';
                    const cred = JSON.parse(item.providerCredentials);
                    return cred.provider== 'TBO';
                });
                // console.log(tboCred,'tboCred');

                if (tboCred.length > 0) {
                    roomQuoteRequest['assignedId'] = tboCred[0]?.assignedId;
                    roomQuoteRequest['providerCred'] = tboCred[0]?.providerCredentials;

                    const tboRoomQuoteResult = this.tboRoomService.searchRoomQuote(roomQuoteReq, JSON.parse(tboCred[0]?.providerCredentials));
                    roomQuoteResults.push(tboRoomQuoteResult);
                }
            }

            /* For HOB (Hotelbeds) */
            if (activeProvidersName.indexOf('HOB') !== -1) {
                /* Filtering configuration with HOB only */
                const hobCred = activeProviders.filter((item) => {
                    return item.code == 'HOB';
                });

                if (hobCred.length > 0) {
                    roomQuoteRequest['assignedId'] = hobCred[0]?.assignedId;
                    roomQuoteRequest['providerCred'] = hobCred[0]?.providerCredentials;

                    // TODO: Implement Hotelbeds room quote service
                    // const hotelbedsRoomQuoteResult = this.hotelbedsRoomService.searchRoomQuote(roomQuoteRequest);
                    // roomQuoteResults.push(hotelbedsRoomQuoteResult);
                }
            }

            /* Checking for first come response from the Providers */
            let result: HotelRoomQuoteResponse;
            try {
                if (roomQuoteResults.length === 0) {
                    throw new InternalServerErrorException('ERR_NO_ACTIVE_PROVIDERS');
                }
                result = await Promise.race(roomQuoteResults);
            } catch (error) {
                console.log('supplier room quote error', error);
                throw new InternalServerErrorException('ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER');
            }
            const results: HotelRoomQuoteResponse = result;

            return results;
        } catch (error) {
            console.log('supplier room quote error', error);
            throw new InternalServerErrorException('ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER');
        }
    }
}
