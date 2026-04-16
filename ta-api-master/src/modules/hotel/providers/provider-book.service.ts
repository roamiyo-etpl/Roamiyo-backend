import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HotelBookConfirmationResponse } from '../book/interfaces/book-confirmation-response.interface';
import { TboBookService } from './tbo/tbo-book.service';

@Injectable()
export class ProviderBookService {
    constructor(
        private readonly tboBookService: TboBookService,
    ) { }

    // async bookConfirmation(bookReq, headers): Promise<HotelBookConfirmationResponse> {
    async bookConfirmation(bookReq, headers): Promise<any> {

        
        const { activeProviders } = bookReq;
        // console.log(activeProviders, bookReq, "data",  headers);
        const bookRequest: any[] = [];

        try {

            const bookResult: Promise<any>[] = [];

            const activeProvidersName = activeProviders.map((data) => {
                const cred = JSON.parse(data.providerCredentials);
                return cred.provider;
            });

            const language = headers['language']?.toUpperCase() || 'en';
            Object.assign(bookReq, { currency: headers['currency-preference']?.toUpperCase() || 'USD' });
            Object.assign(bookReq, { language: language });

            /* Get Currency Rates */
            bookRequest['language'] = language;
            bookRequest['bookReq'] = bookReq;


            // console.log("activeProvidersName", activeProvidersName);

            /* For TBO */
            if (activeProvidersName.indexOf('TBO') !== -1) {
                console.log('TBO found for room book');
                /* Filtering configuration with TBO only */
                const tboCred = activeProviders.filter((item) => {
                    // return item.providerCredentials.provider == 'TBO';
                    const cred = JSON.parse(item.providerCredentials);
                    return cred.provider == 'TBO';
                });
                // console.log(tboCred,'tboCred');

                if (tboCred.length > 0) {
                    bookRequest['assignedId'] = tboCred[0]?.assignedId;
                    bookRequest['providerCred'] = tboCred[0]?.providerCredentials;

                    const tboBookResult =await this.tboBookService.bookConfirmation(bookReq, JSON.parse(tboCred[0]?.providerCredentials), headers);
                    bookResult.push(tboBookResult);
                }
            }

            /* For HOB (Hotelbeds) */
            if (activeProvidersName.indexOf('HOB') !== -1) {
                /* Filtering configuration with HOB only */
                const hobCred = activeProviders.filter((item) => {
                    return item.code == 'HOB';
                });

                if (hobCred.length > 0) {
                    bookRequest['assignedId'] = hobCred[0]?.assignedId;
                    bookRequest['providerCred'] = hobCred[0]?.providerCredentials;
                }
            }

            const result = bookResult;

            return Array.isArray(result) ? result[0] : result;

        } catch (error) {
            console.log('supplier room book error', error);
            throw new InternalServerErrorException('ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER');
        }
    }

}

