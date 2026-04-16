import { BadRequestException, Injectable } from '@nestjs/common';
import { CancelService as FlightCancelService } from '../flight/cancel/cancel.service';
import { GenericCancelDto, GenericGetCancellationChargesDto } from './dto/cancel.dto';

@Injectable()
export class GenericCancelService {
    constructor(private readonly flightCancelService: FlightCancelService) {}

    async cancel(reqParams: { cancelReq: GenericCancelDto; headers: any }) {
        const { cancelReq, headers } = reqParams;

        const mode = (cancelReq.mode || '').toString().toLowerCase();
        if (mode === 'flight') {
            const flightReq = { ...cancelReq } as any;
            delete flightReq.mode;
            return this.flightCancelService.cancelFlight({ cancelReq: flightReq, headers });
        }
        if (mode === 'hotel') {
            throw new BadRequestException('Hotel cancellation is not implemented');
        }
        throw new BadRequestException('Invalid mode. Allowed: "flight" | "hotel"');
    }

    async getCancellationCharges(reqParams: { cancelReq: GenericGetCancellationChargesDto; headers: any }) {
        const { cancelReq, headers } = reqParams;
        const mode = (cancelReq.mode || '').toString().toLowerCase();
        if (mode === 'flight') {
            const flightReq = { ...cancelReq } as any;
            delete flightReq.mode;
            return this.flightCancelService.getCancellationCharges({ cancelReq: flightReq, headers });
        }
        if (mode === 'hotel') {
            throw new BadRequestException('Hotel cancellation charges are not implemented');
        }
        throw new BadRequestException('Invalid mode. Allowed: "flight" | "hotel"');
    }
}


