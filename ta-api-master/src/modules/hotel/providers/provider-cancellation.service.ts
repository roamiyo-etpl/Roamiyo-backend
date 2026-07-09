import { Injectable, NotFoundException } from '@nestjs/common';
import { CancelResponse } from 'src/modules/cancel/interfaces/cancel.interface';
import { ConfigurationService } from '../configuration/configuration.service';
import { TboCancellationService } from './tbo/tbo-cancellation.service';
import { supplierReferenceIncludes } from 'src/shared/utilities/flight/supplier-reference.utility';
import { HotelCancelPollInput } from '../cancel/dtos/hotel-cancel.dto';

type HotelProviderCancelReq = {
    bookingId: number;
    requestType?: string;
    supplierParams?: { remarks?: string; providerCode?: string };
} & HotelCancelPollInput;

@Injectable()
export class ProviderCancellationService {
    constructor(
        private readonly configService: ConfigurationService,
        private readonly tboCancellationService: TboCancellationService,
    ) {}

    async providerCancel(reqParams: {
        cancelReq: HotelProviderCancelReq;
        headers: Record<string, unknown>;
        booking: {
            booking_id: string;
            supplier_name?: string;
            supplier_reference_id?: string;
            booking_reference_id?: string;
            search_id?: string;
        };
    }): Promise<CancelResponse> {
        const { cancelReq, headers, booking } = reqParams;

        console.log('════════════════ HOTEL PROVIDER CANCEL START ════════════════');
        console.log('[HOTEL-PROVIDER-CANCEL] cancelReq:', JSON.stringify(cancelReq, null, 2));
        console.log('[HOTEL-PROVIDER-CANCEL] booking.supplier_reference_id:', booking?.supplier_reference_id);

        const providerCode = (booking.supplier_name || cancelReq.supplierParams?.providerCode || '').toUpperCase();
        const providerCred = await this.resolveProviderCredentials(providerCode, cancelReq.bookingId, booking);

        const cancelPayload = {
            cancelReq,
            providerCred,
            headers,
            booking,
        };

        let cancelResult: CancelResponse | null = null;

        if (providerCode === 'TBO') {
            console.log('[HOTEL-PROVIDER-CANCEL] Routing to TBO hotel cancellation');
            cancelResult = await this.tboCancellationService.cancel(cancelPayload);
            console.log('[HOTEL-PROVIDER-CANCEL] TBO response:', JSON.stringify(cancelResult, null, 2));
        }

        if (!cancelResult) {
            throw new NotFoundException(
                `Provider ${providerCode || 'UNKNOWN'} is not supported for hotel cancellation`,
            );
        }

        console.log('════════════════ HOTEL PROVIDER CANCEL END ════════════════');
        return cancelResult;
    }

    async providerPollCancelStatus(reqParams: {
        cancelReq: HotelProviderCancelReq;
        headers: Record<string, unknown>;
        booking: {
            booking_id: string;
            supplier_name?: string;
            supplier_reference_id?: string;
            search_id?: string;
        };
        changeRequestId: number;
    }): Promise<CancelResponse> {
        const { cancelReq, headers, booking, changeRequestId } = reqParams;

        console.log('════════════════ HOTEL PROVIDER POLL STATUS START ════════════════');
        console.log('[HOTEL-PROVIDER-POLL] changeRequestId:', changeRequestId);

        const providerCode = (booking.supplier_name || cancelReq.supplierParams?.providerCode || '').toUpperCase();
        const providerCred = await this.resolveProviderCredentials(providerCode, cancelReq.bookingId, booking);

        let result: CancelResponse | null = null;

        if (providerCode === 'TBO') {
            result = await this.tboCancellationService.pollCancelStatus({
                changeRequestId,
                providerCred,
                headers,
                booking,
                pollMaxAttempts: cancelReq.pollMaxAttempts,
                pollIntervalMs: cancelReq.pollIntervalMs,
                pollTimeoutMs: cancelReq.pollTimeoutMs,
            });
            console.log('[HOTEL-PROVIDER-POLL] TBO response:', JSON.stringify(result, null, 2));
        }

        if (!result) {
            throw new NotFoundException(
                `Provider ${providerCode || 'UNKNOWN'} is not supported for hotel cancellation status`,
            );
        }

        console.log('════════════════ HOTEL PROVIDER POLL STATUS END ════════════════');
        return result;
    }

    private async resolveProviderCredentials(
        providerCode: string,
        bookingId: number,
        booking: { supplier_reference_id?: string },
    ): Promise<Record<string, unknown>> {
        if (
            !booking ||
            !supplierReferenceIncludes(booking.supplier_reference_id, bookingId)
        ) {
            console.log('[HOTEL-PROVIDER-CANCEL] Booking mismatch');
            throw new NotFoundException(
                'Booking mismatch: bookingId does not match supplier reference id',
            );
        }

        console.log('[HOTEL-PROVIDER-CANCEL] providerCode:', providerCode);

        const providerConfig = await this.configService.getConfiguration({
            supplierCode: providerCode,
            mode: '',
            module: 'Hotel',
        });

        if (!providerConfig) {
            console.log('[HOTEL-PROVIDER-CANCEL] Provider config not found');
            throw new NotFoundException(
                'Provider code is not valid. Check your provider code and try again.',
            );
        }

        return JSON.parse(providerConfig.provider_credentials);
    }
}
