import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { ProviderMaster } from 'src/shared/entities/provider-master.entity';

@Injectable()
export class SupplierCredService {
    constructor(@InjectRepository(ProviderMaster) private assignedProviderRepo: Repository<ProviderMaster>) {}

    async getActiveProviders(headers): Promise<ProviderMaster[]> {
        try {
            // Determine provider mode based on environment
            // const providerMode = process.env.NODE_ENV === 'development' ? 'Test' : 'Production';

            let activeProviders;
            if (headers.providerCode && headers.providerCode !== '') {
                activeProviders = await this.assignedProviderRepo.find({
                    where: { is_active: 'Active', code: headers.providerCode, module_type: headers.moduleType || 'Hotel' },
                });
            } else {
                activeProviders = await this.assignedProviderRepo.find({
                    where: { is_active: 'Active', module_type: headers.moduleType || 'Hotel' },
                });
            }
            // console.log('activeProviders', activeProviders);

            if (!activeProviders || activeProviders.length == 0) {
                throw new NotFoundException('ERR_NO_ACTIVE_SUPPLIER_FOUND');
            }

            return activeProviders;
        } catch (error) {
            throw new InternalServerErrorException(error);
        }
    }

    async getInActiveProviders(clubId): Promise<ProviderMaster[]> {
        try {
            const activeProviders = await this.assignedProviderRepo.find({
                where: { is_active: 'Inactive', module_type: 'Hotel' },
            });

            return activeProviders;
        } catch (error) {
            throw new InternalServerErrorException(error);
        }
    }

    async getProviderConfiguration(supplierCode, mode: any = ''): Promise<ProviderMaster | null> {
        if (supplierCode != '') {
            if (mode == '') {
                return await this.assignedProviderRepo.findOne({
                    where: {
                        code: supplierCode,
                        is_active: 'Active',
                        module_type: 'Hotel',
                    },
                });
            }

            return await this.assignedProviderRepo.findOne({
                where: {
                    code: supplierCode,
                    provider_mode: mode.charAt(0).toUpperCase() + mode.slice(1),
                    module_type: 'Hotel',
                },
            });
        }
        return null;
    }
}
