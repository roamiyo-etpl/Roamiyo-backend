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
        const providerConfig = await this.configService.getConfiguration(providerCode);

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
        if (!booking || cancelReq.bookingId.toString() !== (booking.supplier_reference_id || '').toString()) {
            throw new NotFoundException('Booking mismatch: bookingId does not match supplier reference id');
        }
        const providerCode = (booking.supplier_name || '').toUpperCase();
        const providerConfig = await this.configService.getConfiguration(providerCode);
        if (!providerConfig) {
            throw new NotFoundException('Provider code is not valid, Check your provider code and try again.');
        }
        const cancelRequest = [];
        cancelRequest['cancelReq'] = cancelReq;
        cancelRequest['providerCred'] = JSON.parse(providerConfig.provider_credentials);
        cancelRequest['headers'] = headers;

        if (providerCode === 'TBO') {
            return this.tboCancellationService.fetchCancellationCharges(cancelRequest);
        }

        throw new NotFoundException(`Provider ${providerCode || 'UNKNOWN'} is not supported for cancellation charges`);
    }
}

