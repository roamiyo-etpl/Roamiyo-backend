import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CurrencyService } from '../../../modules/generic/currency/currency.service';

@Injectable()
export class CommonScheduler {
    constructor(private readonly currencyService: CurrencyService) {}

    // @Cron('0 */4 * * *', { name: 'UpdateCurrencyConversion' }) // Runs every 4 hours
    async updateCurrencyConversion() {
        try {
            await this.currencyService.updateCurrencyData();
        } catch (error) {
            console.error('Error in updateCurrencyConversion scheduler', error);
        }
    }
}
