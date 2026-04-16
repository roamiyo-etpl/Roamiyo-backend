import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { TboOrderDetailService } from "./tbo/tbo-order-detail.service";

@Injectable()
export class ProviderOrderDetailService {
    constructor(
        private readonly tboOrderDetailService: TboOrderDetailService,
    ){}

    async orderDetail(orderReq, headers): Promise<any>{
        const { activeProviders } = orderReq;
        const orderRequest: any[] = [];

        
        const orderResult: Promise<any>[] = [];
        try {



            const activeProvidersName = activeProviders.map((data) => {
                const cred = JSON.parse(data.providerCredentials);
                return cred.provider;
            });

            const language = headers['language']?.toUpperCase() || 'en';
            Object.assign(orderReq, { currency: headers['currency-preference']?.toUpperCase() || 'USD' });
            Object.assign(orderReq, { language: language });

            /* Get Currency Rates */
            orderRequest['language'] = language;
            orderRequest['bookReq'] = orderReq;
            /* For TBO */
            if (activeProvidersName.indexOf('TBO') !== -1) {
                console.log('TBO found for book detail');
                /* Filtering configuration with TBO only */
                const tboCred = activeProviders.filter((item) => {
                    // return item.providerCredentials.provider == 'TBO';
                    const cred = JSON.parse(item.providerCredentials);
                    return cred.provider == 'TBO';
                });
                // console.log(tboCred,'tboCred');

                if (tboCred.length > 0) {
                    orderRequest['assignedId'] = tboCred[0]?.assignedId;
                    orderRequest['providerCred'] = tboCred[0]?.providerCredentials;

                    const tboOrderResult =await this.tboOrderDetailService.orderDetail(orderReq, JSON.parse(tboCred[0]?.providerCredentials), headers);
                    orderResult.push(tboOrderResult);
                }
            }

            const result = orderResult;
            console.log(orderResult)

            return Array.isArray(result) ? result[0] : result;
            
        } catch (error) {
            console.log('supplier book detail error', error);
            throw new InternalServerErrorException('ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER');
            
            
        }
    }

}