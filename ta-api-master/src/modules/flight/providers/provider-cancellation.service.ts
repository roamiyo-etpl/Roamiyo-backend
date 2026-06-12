import { Injectable, NotFoundException } from '@nestjs/common';
import { CancelResponse } from 'src/modules/cancel/interfaces/cancel.interface';
import { ConfigurationService } from '../configuration/configuration.service';
import { TboCancellationService } from './tbo/tbo-cancellation.service';
import { redactTboCredentialsForLog } from 'src/shared/utilities/flight/tbo-request-context.utility';
import { supplierReferenceIncludes } from 'src/shared/utilities/flight/supplier-reference.utility';

@Injectable()
export class ProviderCancellationService {
    constructor(
        private configService: ConfigurationService,
        private tboCancellationService: TboCancellationService,
    ) { }


    // async providerCancel(reqParams): Promise<CancelResponse> {
    //     const { cancelReq, headers, booking } = reqParams;
    //     // Validate bookingId matches booking.supplier_reference_id
    //     if (!booking || cancelReq.bookingId.toString() !== (booking.supplier_reference_id || '').toString()) {
    //         throw new NotFoundException('Booking mismatch: bookingId does not match supplier reference id');
    //     }
    //     // Derive provider code from booking
    //     const providerCode = (booking.supplier_name || '').toUpperCase();
    //     // const providerConfig = await this.configService.getConfiguration(providerCode);
    //     const providerConfig = await this.configService.getConfiguration({
    //         supplierCode: providerCode,
    //         mode: '',
    //         module: 'Flight',
    //     });

    //     if (!providerConfig) {
    //         throw new NotFoundException('Provider code is not valid, Check your provider code and try again.');
    //     }

    //     const cancelPayload = {
    //         cancelReq,
    //         providerCred: JSON.parse(providerConfig.provider_credentials),
    //         headers,
    //         booking,
    //     };
    //     /* Check for provider code First and transform the request to particular provider */
    //     let cancelResult: CancelResponse | null = null;

    //     /* For TBO */
    //     if (providerCode === 'TBO') {
    //         cancelResult = await this.tboCancellationService.cancel(cancelPayload);
    //     }

    //     if (!cancelResult) {
    //         throw new NotFoundException(`Provider ${providerCode || 'UNKNOWN'} is not supported for cancellation`);
    //     }

    //     return cancelResult;
    // }

    async providerCancel(reqParams): Promise<CancelResponse> {

        const { cancelReq, headers, booking } = reqParams;

        console.log("════════════════ PROVIDER CANCEL START ════════════════");

        console.log("[PROVIDER-CANCEL] Incoming cancelReq:",
            JSON.stringify(cancelReq, null, 2)
        );

        console.log("[PROVIDER-CANCEL] Incoming booking:",
            JSON.stringify(booking, null, 2)
        );

        try {

            // STEP 1: VALIDATE BOOKING MATCH
            console.log("[PROVIDER-CANCEL][STEP-1] Validating bookingId match");

            console.log("[PROVIDER-CANCEL][STEP-1] cancelReq.bookingId:",
                cancelReq.bookingId.toString()
            );

            console.log("[PROVIDER-CANCEL][STEP-1] booking.supplier_reference_id:",
                booking?.supplier_reference_id
            );

            if (
                !booking ||
                !supplierReferenceIncludes(
                    booking.supplier_reference_id,
                    cancelReq.bookingId,
                )
            ) {

                console.log("[PROVIDER-CANCEL][STEP-1] Booking mismatch found");

                throw new NotFoundException(
                    'Booking mismatch: bookingId does not match supplier reference id'
                );
            }

            console.log("[PROVIDER-CANCEL][STEP-1] Booking validation success");

            // STEP 2: GET PROVIDER CODE
            const providerCode = (booking.supplier_name || '').toUpperCase();

            console.log("[PROVIDER-CANCEL][STEP-2] providerCode:",
                providerCode
            );

            // STEP 3: FETCH PROVIDER CONFIG
            console.log("[PROVIDER-CANCEL][STEP-3] Fetching provider configuration");

            const providerConfig = await this.configService.getConfiguration({
                supplierCode: providerCode,
                mode: '',
                module: 'Flight',
            });

            console.log("[PROVIDER-CANCEL][STEP-3] providerConfig:",
                JSON.stringify(providerConfig, null, 2)
            );

            if (!providerConfig) {

                console.log("[PROVIDER-CANCEL][STEP-3] Provider config not found");

                throw new NotFoundException(
                    'Provider code is not valid, Check your provider code and try again.'
                );
            }

            // STEP 4: BUILD CANCEL PAYLOAD
            console.log("[PROVIDER-CANCEL][STEP-4] Building cancel payload");

            const cancelPayload = {
                cancelReq,
                providerCred: JSON.parse(providerConfig.provider_credentials),
                headers,
                booking,
            };

            console.log("[PROVIDER-CANCEL][STEP-4] cancelPayload:",
                JSON.stringify(cancelPayload, null, 2)
            );

            let cancelResult: CancelResponse | null = null;

            // STEP 5: PROVIDER SWITCH
            console.log("[PROVIDER-CANCEL][STEP-5] Checking provider handler");

            if (providerCode === 'TBO') {

                console.log("[PROVIDER-CANCEL][STEP-5] TBO provider matched");

                console.log("[PROVIDER-CANCEL][STEP-5] Calling tboCancellationService.cancel");

                cancelResult = await this.tboCancellationService.cancel(cancelPayload);

                console.log("[PROVIDER-CANCEL][STEP-5] TBO cancellation response:",
                    JSON.stringify(cancelResult, null, 2)
                );
            }

            // STEP 6: VALIDATE PROVIDER RESPONSE
            if (!cancelResult) {

                console.log("[PROVIDER-CANCEL][STEP-6] No provider matched");

                throw new NotFoundException(
                    `Provider ${providerCode || 'UNKNOWN'} is not supported for cancellation`
                );
            }

            console.log("[PROVIDER-CANCEL] Final response:",
                JSON.stringify(cancelResult, null, 2)
            );

            console.log("════════════════ PROVIDER CANCEL END ════════════════");

            return cancelResult;

        } catch (error) {

            console.error("[PROVIDER-CANCEL] ERROR OCCURRED");
            console.error(error);

            throw error;
        }
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
            !supplierReferenceIncludes(
                booking.supplier_reference_id,
                cancelReq.bookingId,
            )
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
                JSON.stringify(
                    redactTboCredentialsForLog(
                        parsedProviderCred as Record<string, unknown>,
                    ),
                    null,
                    2,
                ),
            );
        } catch (err) {
            console.log('Error parsing provider credentials =>', err.message);
            throw err;
        }

        const cancelPayload = {
            cancelReq,
            providerCred: parsedProviderCred,
            headers,
            booking,
        };

        console.log(
            'Prepared cancelRequest object =>',
            JSON.stringify(
                {
                    cancelReq: cancelPayload.cancelReq,
                    headers: cancelPayload.headers,
                    providerCred: redactTboCredentialsForLog(
                        cancelPayload.providerCred as Record<string, unknown>,
                    ),
                },
                null,
                2,
            ),
        );

        if (providerCode === 'TBO') {
            console.log('Routing to TBO Cancellation Service');

            return this.tboCancellationService.fetchCancellationCharges(
                cancelPayload,
            );
        }

        console.log('Unsupported provider =>', providerCode);

        throw new NotFoundException(
            `Provider ${providerCode || 'UNKNOWN'} is not supported for cancellation charges`,
        );
    }
}

