import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigurationService } from '../configuration/configuration.service';
import { BalanceCheckResponse } from '../balance-check/interfaces/balance-response.interface';
import { BalanceCheckDto } from '../balance-check/dtos/balance-check.dto';

@Injectable()
export class ProviderBalanceService {
    constructor(private readonly configService: ConfigurationService) {}

    /** [@Description: This method is used to check the balance of the provider]
     * @author: Prashant Joshi at 23-09-2025 **/
    async providerBalanceCheck(balanceReq: BalanceCheckDto): Promise<BalanceCheckResponse> {
        /* Added a validation to show the data based on environment */
        if (balanceReq.mode.toLowerCase() == 'test' || balanceReq.mode.toLowerCase() == 'production') {
            const providerConfig = await this.configService.getConfiguration({ supplierCode: balanceReq.providerCode.toUpperCase(), mode: balanceReq.mode, module: 'Flight' });

            if (!providerConfig) {
                throw new NotFoundException('Provider code is not valid, Check your provider code and try again.');
            }

            const balanceRequest = [];
            let balanceResult;

            balanceRequest['balanceReq'] = balanceReq;
            balanceRequest['providerCred'] = JSON.parse(providerConfig.provider_credentials);

            /* Check for provider code First and transform the request to particular provider */
            switch (balanceReq.providerCode.toUpperCase()) {
                case 'QN':
                    // balanceResult = this.qunarBalanceService.balanceCheck(balanceRequest);
                    break;
                default:
                    throw new NotFoundException('Provider code is not valid, Check your provider code and try again.');
            }

            return balanceResult;
        } else {
            throw new BadRequestException("mode should be 'test' or 'production'");
        }
    }
}
