import { BadRequestException, Injectable } from '@nestjs/common';
import { CancelService as FlightCancelService } from '../flight/cancel/cancel.service';
import { HotelCancelService } from '../hotel/cancel/cancel.service';
import { GenericCancelDto, GenericGetCancellationChargesDto } from './dto/cancel.dto';
import { HotelCancelStatusDto } from '../hotel/cancel/dtos/hotel-cancel-status.dto';

@Injectable()
export class GenericCancelService {
    constructor(
        private readonly flightCancelService: FlightCancelService,
        private readonly hotelCancelService: HotelCancelService,
    ) {}

    // async cancel(reqParams: { cancelReq: GenericCancelDto; headers: any }) {
    //     const { cancelReq, headers } = reqParams;

    //     const mode = (cancelReq.mode || '').toString().toLowerCase();
    //     if (mode === 'flight') {
    //         const flightReq = { ...cancelReq } as any;
    //         delete flightReq.mode;
    //         return this.flightCancelService.cancelFlight({ cancelReq: flightReq, headers });
    //     }
    //     if (mode === 'hotel') {
    //         throw new BadRequestException('Hotel cancellation is not implemented');
    //     }
    //     throw new BadRequestException('Invalid mode. Allowed: "flight" | "hotel"');
    // }

    async cancel(reqParams: { cancelReq: GenericCancelDto; headers: any }) {
        const { cancelReq, headers } = reqParams;
    
        console.log("════════════════ CANCEL API START ════════════════");
        console.log("[CANCEL][ENTRY] Incoming Request");
        console.log("[CANCEL][ENTRY] cancelReq:", JSON.stringify(cancelReq, null, 2));
        console.log("[CANCEL][ENTRY] headers:", JSON.stringify(headers, null, 2));
    
        const mode = (cancelReq.mode || '').toString().toLowerCase();
    
        console.log("[CANCEL][ENTRY] mode:", mode);
    
        if (mode === 'flight') {
            console.log("[CANCEL][ENTRY] Flight cancellation flow started");
    
            const flightReq = { ...cancelReq } as any;
            delete flightReq.mode;
    
            console.log("[CANCEL][ENTRY] Final flightReq:", JSON.stringify(flightReq, null, 2));
    
            const response = await this.flightCancelService.cancelFlight({
                cancelReq: flightReq,
                headers
            });
    
            console.log("[CANCEL][ENTRY] Flight cancellation response:",
                JSON.stringify(response, null, 2)
            );
    
            console.log("════════════════ CANCEL API END ════════════════");
    
            return response;
        }
    
        if (mode === 'hotel') {
            console.log('[CANCEL][ENTRY] Hotel cancellation flow started');

            const hotelReq = { ...cancelReq } as GenericCancelDto;
            delete (hotelReq as { mode?: string }).mode;

            const response = await this.hotelCancelService.cancelHotel({
                cancelReq: hotelReq,
                headers,
            });

            console.log('[CANCEL][ENTRY] Hotel cancellation response:',
                JSON.stringify(response, null, 2),
            );

            console.log('════════════════ CANCEL API END ════════════════');

            return response;
        }
    
        console.log("[CANCEL][ENTRY] Invalid mode received:", mode);
    
        throw new BadRequestException('Invalid mode. Allowed: "flight" | "hotel"');
    }

    async getCancelStatus(reqParams: { statusReq: HotelCancelStatusDto; headers: any }) {
        const { statusReq, headers } = reqParams;

        const mode = (statusReq.mode || '').toString().toLowerCase();

        if (mode === 'hotel') {
            return this.hotelCancelService.getHotelCancelStatus({ statusReq, headers });
        }

        throw new BadRequestException(
            'Cancel status polling is only supported for hotel. Use mode: "hotel".',
        );
    }

    async getCancellationCharges(reqParams: { cancelReq: GenericGetCancellationChargesDto; headers: any }) {
        const { cancelReq, headers } = reqParams;

        
    
        console.log('================ CONTROLLER: GET CANCELLATION CHARGES ================');
        console.log('Incoming Headers =>', JSON.stringify(headers, null, 2));
        console.log('Incoming cancelReq =>', JSON.stringify(cancelReq, null, 2));
    
        const mode = (cancelReq.mode || '').toString().toLowerCase();
    
        console.log('Resolved Mode =>', mode);
    
        if (mode === 'flight') {
            console.log('Routing request to Flight Cancellation Service');
    
            const flightReq = { ...cancelReq } as any;
            delete flightReq.mode;
    
            console.log('Prepared Flight Request =>', JSON.stringify(flightReq, null, 2));
    
            return this.flightCancelService.getCancellationCharges({
                cancelReq: flightReq,
                headers,
            });
        }
    
        if (mode === 'hotel') {
            console.log('[CANCEL-CHARGES] Hotel mode not supported in Travel Tek — use payment service');

            throw new BadRequestException(
                'Hotel cancellation charges are handled by the payment service. Use POST /cancel to cancel a hotel booking.',
            );
        }
    
        console.log('Invalid mode received =>', mode);
    
        throw new BadRequestException('Invalid mode. Allowed: "flight" | "hotel"');
    }
}


