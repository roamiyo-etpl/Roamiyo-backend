import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ModuleType, ProviderMaster } from 'src/shared/entities/provider-master.entity';
import { DateUtility } from 'src/shared/utilities/flight/date.utility';
import { Repository } from 'typeorm';
import { throwHotelApiError } from 'src/shared/utilities/hotel/hotel-error.utility';

@Injectable()
export class ConfigurationService {
    constructor(@InjectRepository(ProviderMaster) private providerRepository: Repository<ProviderMaster>) {}

    /** [@Description: Get active provider list]
     * @author: Prashant Joshi at 23-09-2025 **/
    async getActiveProviderList({ module }: { module: ModuleType }): Promise<ProviderMaster[]> {
        return await this.providerRepository.find({
            where: {
                is_active: 'Active',
                module_type: module,
            },
        });
    }

    /** [@Description: Get configuration]
     * @author: Prashant Joshi at 23-09-2025 **/
    async getConfiguration({ supplierCode, mode, module }): Promise<ProviderMaster | null> {
        if (supplierCode != '') {
            if (mode == '') {
                return await this.providerRepository.findOne({
                    where: {
                        code: supplierCode,
                        is_active: 'Active',
                        module_type: module,
                    },
                });
            } else {
                return await this.providerRepository.findOne({
                    where: {
                        code: supplierCode,
                        provider_mode: mode?.charAt(0)?.toUpperCase() + mode?.slice(1),
                        module_type: module,
                    },
                });
            }
        }
        return null;
    }

    async getToken({ searchRequest, module }) {
        try {
            /*Check if token is expired or not ( token is valid for the same day only )  */
            const currentDate = DateUtility.currentDateOnlyIST();
            const checkToken = await this.providerRepository.findOne({
                select: ['authToken'],
                where: {
                    code: searchRequest.providerCred?.provider,
                    provider_mode: searchRequest.providerCred?.mode,
                    tokenUpdatedAt: currentDate,
                    module_type: module,
                },
            });
            return checkToken?.authToken;
        } catch (error) {
            throwHotelApiError(error, 'Failed to read hotel provider auth token');
        }
    }

    async updateAuthToken({ newAuthToken, searchRequest, module }) {
        try {
            const currentDate = DateUtility.currentDateOnlyIST();
            await this.providerRepository.update({ code: searchRequest.providerCred?.provider, provider_mode: searchRequest.providerCred?.mode, module_type: module }, { authToken: newAuthToken, tokenUpdatedAt: currentDate });
        } catch (error) {
            console.log(error);
            throwHotelApiError(error, 'Failed to update hotel provider auth token');
        }
    }

    async getProviderId() {
        try {
            const tboId: any = await this.providerRepository.findOne({
                select: ['provider_id'],
                where: { code: 'TBO' },
            });
            if (!tboId) {
                throwHotelApiError(new Error('TBO hotel provider configuration not found'), 'TBO hotel provider configuration not found');
            }
            return tboId?.providerId;
        } catch (error) {
            throwHotelApiError(error, 'Failed to fetch hotel provider configuration');
        }
    }
}
