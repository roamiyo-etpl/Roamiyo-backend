import { Injectable } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyConversionEntity } from '../../../shared/entities/currency-rate.entity';

@Injectable()
export class CurrencyRepository {
    constructor(
        @InjectRepository(CurrencyConversionEntity)
        private readonly currencyRepo: Repository<CurrencyConversionEntity>,
    ) {}

    /** [@Description: Get all currency data]
     * @author: Mohit Soni at 16-09-2025 **/
    async getCurrencyData(): Promise<CurrencyConversionEntity[]> {
        const currencies = await this.currencyRepo.find();

        if (!currencies || currencies.length === 0) {
            return [];
        } else {
            return currencies;
        }
    }

    /** [@Description: Add currency data]
     * @author: Mohit Soni at 16-09-2025 **/
    async addCurrencyData(currencies) {
        try {
            const currenciesData: CurrencyConversionEntity[] = [];
            const result = Object.values(currencies);

            if (result && result.length > 0) {
                for (const currency of result as any) {
                    const currencyData: CurrencyConversionEntity = new CurrencyConversionEntity();

                    currencyData.code = currency.id;
                    currencyData.name = currency.currencyName;
                    currencyData.symbol = currency?.currencySymbol ?? currency.id;

                    currenciesData.push(currencyData);
                }

                if (currenciesData.length > 0) {
                    return await this.currencyRepo.save(currenciesData);
                } else {
                    return [];
                }
            } else {
                return [];
            }
        } catch (error) {
            console.log('Error in addCurrencyData', error);
            throw error;
        }
    }

    /** [@Description: Upsert baseRateUSD from USD_* pair response objects]
     * Accepts either an array of plain objects (e.g., [{ USD_AED: 3.67, ... }, ...])
     * or Promise.allSettled results where fulfilled.value is that object.
     * Returns the number of currency rows updated.
     */
    async upsertUsdBaseRatesFromResponse(currencyResponse: any[]): Promise<number> {
        try {
            const codeToRateMap = new Map<string, number>();

            for (const item of currencyResponse || []) {
                const data = item && typeof item === 'object' && 'status' in item ? (item.status === 'fulfilled' ? item.value : null) : item;
                if (!data || typeof data !== 'object') continue;

                for (const [pair, rate] of Object.entries(data as Record<string, unknown>)) {
                    if (typeof rate !== 'number') continue;
                    // Expect pairs like "USD_AED"
                    const parts = pair.split('_');
                    if (parts.length !== 2) continue;
                    const [base, quote] = parts;
                    if (base !== 'USD') continue; // Only USD base supported here
                    const code = quote.toUpperCase();
                    codeToRateMap.set(code, rate);
                }
            }

            if (codeToRateMap.size === 0) {
                return 0;
            }

            const codes = Array.from(codeToRateMap.keys());
            const existing = await this.currencyRepo.find({ where: { code: In(codes) } });
            if (!existing.length) {
                return 0;
            }

            for (const entity of existing) {
                const rate = codeToRateMap.get(entity.code);
                if (typeof rate === 'number') {
                    entity.baseRateUSD = rate;
                }
            }

            await this.currencyRepo.save(existing);
            return existing.length;
        } catch (error) {
            console.log('Error in upsertUsdBaseRatesFromResponse', error);
            throw error;
        }
    }
}
