import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigurationService } from '../configuration/configuration.service';
import { OrderDetailResponse } from '../order-details/interfaces/order-detail.interface';
import { TboOrderDetailService } from './tbo/tbo-order-detail.service';

@Injectable()
export class ProviderOrderDetailService {
    constructor(
        private configService: ConfigurationService,
        private tboOrderService: TboOrderDetailService,
    ) {}

    /** [@Description: This method is used to get the order details]
     * @author: Prashant Joshi at 23-09-2025 **/
    async providerOrderDetail(reqParams): Promise<{ orderDetails: OrderDetailResponse[]; supplierOrderDetailResponse: any[] }> {
        const { orderDetailDto, headers } = reqParams;
        if (orderDetailDto.mode.toLowerCase() == 'test' || orderDetailDto.mode.toLowerCase() == 'production') {
            const providerConfig = await this.configService.getConfiguration({ supplierCode: orderDetailDto.providerCode.toUpperCase(), mode: orderDetailDto.mode.toLowerCase(), module: 'Flight' });

            if (!providerConfig) {
                throw new NotFoundException('Provider code is not valid, Check your provider code and try again.');
            }

            const orderRequest = [];
            let orderResult;

            orderRequest['orderReq'] = orderDetailDto;
            orderRequest['providerCred'] = JSON.parse(providerConfig.provider_credentials);
            orderRequest['headers'] = headers || { 'ip-address': '127.0.0.1' };
            /* Check for provider code First and transform the request to particular provider */
            switch (orderDetailDto.providerCode.toUpperCase()) {
                case 'TBO':
                    orderResult = this.tboOrderService.getOrderDetails(orderRequest);
                    break;
            }

            return orderResult;
        } else {
            throw new BadRequestException("mode should be 'test' or 'production'");
        }
    }
}
