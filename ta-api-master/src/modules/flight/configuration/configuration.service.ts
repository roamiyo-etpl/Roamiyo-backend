import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ModuleType, ProviderMaster } from 'src/shared/entities/provider-master.entity';
import { DateUtility } from 'src/shared/utilities/flight/date.utility';
import { Repository } from 'typeorm';

@Injectable()
export class ConfigurationService {
    constructor(@InjectRepository(ProviderMaster) private providerRepository: Repository<ProviderMaster>) { }

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

        console.log('================ GET CONFIGURATION ================');

        console.log('Incoming supplierCode =>', supplierCode);
        console.log('Type of supplierCode =>', typeof supplierCode);

        console.log('Incoming mode =>', mode);
        console.log('Type of mode =>', typeof mode);

        console.log('Incoming module =>', module);
        console.log('Type of module =>', typeof module);
        console.log('mode raw value =>', mode);
        console.log('isNaN(mode) =>', isNaN(mode));
        if (supplierCode != '') {

            if (mode == '') {
                console.log('Executing query WITHOUT provider_mode');
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
                    code: searchRequest.providerCred.code,
                    tokenUpdatedAt: currentDate,
                    module_type: module,
                },
            });

            return checkToken?.authToken;
        } catch (error) {
            throw new InternalServerErrorException('There is an issue while fetching data from the providers.');
        }
    }

    async updateAuthToken({ newAuthToken, searchRequest, module }) {
        try {
            const currentDate = DateUtility.currentDateOnlyIST();
            await this.providerRepository.update({ code: searchRequest.providerCred?.provider, module_type: module }, { authToken: newAuthToken, tokenUpdatedAt: currentDate });
        } catch (error) {
            console.log(error);
            throw new InternalServerErrorException('There is an issue while fetching data from the providers.');
        }
    }

    async getProviderId() {
        try {
            const tboId: any = await this.providerRepository.findOne({
                select: ['provider_id'],
                where: { code: 'TBO' },
            });
            if (!tboId) {
                throw new InternalServerErrorException('There is an issue while fetching data from the providers.');
            }
            return tboId?.providerId;
        } catch (error) {
            throw new InternalServerErrorException('There is an issue while fetching data from the providers.');
        }
    }
}
