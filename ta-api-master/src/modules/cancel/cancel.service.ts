import { BadRequestException, Injectable } from '@nestjs/common';
import { CancelService as FlightCancelService } from '../flight/cancel/cancel.service';
import { GenericCancelDto, GenericGetCancellationChargesDto } from './dto/cancel.dto';

@Injectable()
export class GenericCancelService {
    constructor(private readonly flightCancelService: FlightCancelService) {}

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
            console.log("[CANCEL][ENTRY] Hotel cancellation not implemented");
    
            throw new BadRequestException('Hotel cancellation is not implemented');
        }
    
        console.log("[CANCEL][ENTRY] Invalid mode received:", mode);
    
        throw new BadRequestException('Invalid mode. Allowed: "flight" | "hotel"');
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
            console.log('Hotel mode received but not implemented');
    
            throw new BadRequestException('Hotel cancellation charges are not implemented');
        }
    
        console.log('Invalid mode received =>', mode);
    
        throw new BadRequestException('Invalid mode. Allowed: "flight" | "hotel"');
    }
}


