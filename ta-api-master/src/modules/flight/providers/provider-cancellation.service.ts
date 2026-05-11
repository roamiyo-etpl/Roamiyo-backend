import { Injectable, NotFoundException } from '@nestjs/common';
import { CancelResponse } from 'src/modules/cancel/interfaces/cancel.interface';
import { ConfigurationService } from '../configuration/configuration.service';
import { TboCancellationService } from './tbo/tbo-cancellation.service';

@Injectable()
export class ProviderCancellationService {
    constructor(
        private configService: ConfigurationService,
        private tboCancellationService: TboCancellationService,
    ) {}

    
    async providerCancel(reqParams): Promise<CancelResponse> {
        const { cancelReq, headers, booking } = reqParams;
        // Validate bookingId matches booking.supplier_reference_id
        if (!booking || cancelReq.bookingId.toString() !== (booking.supplier_reference_id || '').toString()) {
            throw new NotFoundException('Booking mismatch: bookingId does not match supplier reference id');
        }
        // Derive provider code from booking
        const providerCode = (booking.supplier_name || '').toUpperCase();
        // const providerConfig = await this.configService.getConfiguration(providerCode);
        const providerConfig = await this.configService.getConfiguration({
            supplierCode: providerCode,
            mode: '',
            module: 'Flight',
        });

        if (!providerConfig) {
            throw new NotFoundException('Provider code is not valid, Check your provider code and try again.');
        }

        const cancelRequest = [];

        cancelRequest['cancelReq'] = cancelReq;
        cancelRequest['providerCred'] = JSON.parse(providerConfig.provider_credentials);
        cancelRequest['headers'] = headers;
        cancelRequest['booking'] = booking; // Pass booking details
        /* Check for provider code First and transform the request to particular provider */
        let cancelResult: CancelResponse | null = null;
        
        /* For TBO */
        if (providerCode === 'TBO') {
            cancelResult = await this.tboCancellationService.cancel(cancelRequest);
        }

        if (!cancelResult) {
            throw new NotFoundException(`Provider ${providerCode || 'UNKNOWN'} is not supported for cancellation`);
        }

        return cancelResult;
    }

    async providerCancellationCharges(reqParams) {
        const { cancelReq, headers, booking } = reqParams;
    
        console.log('================ PROVIDER CANCELLATION SERVICE ================');
    
        const providerCode = (booking?.supplier_name || '').toUpperCase();
    
        console.log('booking.supplier_name =>', booking?.supplier_name);
        console.log('providerCode =>', providerCode);
        console.log('providerCode type =>', typeof providerCode);
    
        console.log('Headers =>', JSON.stringify(headers, null, 2));
        console.log('CancelReq =>', JSON.stringify(cancelReq, null, 2));
        console.log('Booking =>', JSON.stringify(booking, null, 2));
    
        if (
            !booking ||
            cancelReq.bookingId.toString() !==
                (booking.supplier_reference_id || '').toString()
        ) {
            console.log('Booking mismatch detected');
            console.log('cancelReq.bookingId =>', cancelReq.bookingId);
            console.log('booking.supplier_reference_id =>', booking?.supplier_reference_id);
    
            throw new NotFoundException(
                'Booking mismatch: bookingId does not match supplier reference id',
            );
        }
    
        console.log('Resolved Provider Code =>', providerCode);
    
        console.log('Fetching provider configuration from DB/config');
    
                // const providerConfig = await this.configService.getConfiguration(providerCode);


        // MAIN FIX HERE
        const providerConfig = await this.configService.getConfiguration({
            supplierCode: providerCode,
            mode: '',
            module: 'Flight',
        });
    
        console.log('Provider Config Query Executed');
    
        if (!providerConfig) {
            console.log('Provider config not found for =>', providerCode);
    
            throw new NotFoundException(
                'Provider code is not valid, Check your provider code and try again.',
            );
        }
    
        console.log('Provider Config Found');
    
        let parsedProviderCred = {};
    
        try {
            parsedProviderCred = JSON.parse(providerConfig.provider_credentials);
    
            console.log(
                'Parsed Provider Credentials =>',
                JSON.stringify(parsedProviderCred, null, 2),
            );
        } catch (err) {
            console.log('Error parsing provider credentials =>', err.message);
            throw err;
        }
    
        const cancelRequest = [];
        cancelRequest['cancelReq'] = cancelReq;
        cancelRequest['providerCred'] = parsedProviderCred;
        cancelRequest['headers'] = headers;
    
        console.log(
            'Prepared cancelRequest object =>',
            JSON.stringify(cancelRequest, null, 2),
        );
    
        if (providerCode === 'TBO') {
            console.log('Routing to TBO Cancellation Service');
    
            return this.tboCancellationService.fetchCancellationCharges(
                cancelRequest,
            );
        }
    
        console.log('Unsupported provider =>', providerCode);
    
        throw new NotFoundException(
            `Provider ${providerCode || 'UNKNOWN'} is not supported for cancellation charges`,
        );
    }
}

