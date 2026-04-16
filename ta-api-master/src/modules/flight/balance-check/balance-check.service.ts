import { Injectable } from '@nestjs/common';
import { ProviderBalanceService } from '../providers/provider-balance.service';
import { BalanceCheckResponse } from './interfaces/balance-response.interface';
import { BalanceCheckDto } from './dtos/balance-check.dto';

@Injectable()
export class BalanceCheckService {
    constructor(private readonly providerBalanceService: ProviderBalanceService) {}

    async checkBalance(balanceReq: BalanceCheckDto): Promise<BalanceCheckResponse> {
        return this.providerBalanceService.providerBalanceCheck(balanceReq);
    }
}
