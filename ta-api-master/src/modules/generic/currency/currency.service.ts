import { Injectable } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CurrencyRepository } from './currency.repository';
import { CommonHttpUtility } from 'src/shared/utilities/common/common-http.utility';
import { HttpRequestInterface } from 'src/shared/interfaces/http-request.interface';

@Injectable()
export class CurrencyService {
    constructor(private readonly currencyRepo: CurrencyRepository) {}

    /** [@Description: Used to update the currency data into DB]
     * @author: Mohit Soni at 19-09-2025 **/
    async updateCurrencyData() {
        try {
            /* Check if we have currencies data in DB or not else Add*/
            let currenciesDB = await this.currencyRepo.getCurrencyData();

            if (!currenciesDB || currenciesDB.length === 0) {
                /* Get the currency details from the third party API */
                const currencyApiParams: HttpRequestInterface = {
                    method: 'GET',
                    url: `${process.env.CURR_RATE_API_URL}currencies?`,
                    apiKey: process.env.CURR_RATE_API_KEY as string,
                };
                const currenciesAPI = await CommonHttpUtility.httpCurrencyConAPI(currencyApiParams);

                if (currenciesAPI.results) {
                    /* Add Currencies into DB */
                    currenciesDB = await this.currencyRepo.addCurrencyData(currenciesAPI.results);
                }
            }

            /* Get Rate of the currencies */
            /* Base with USD */
            const chunkSize = 15;
            const chunkedArr: string[] = [];

            for (let i = 0; i < currenciesDB.length; i += chunkSize) {
                const chunk = currenciesDB.slice(i, i + chunkSize);
                // Create a string of currency codes for this chunk, separated by commas, no trailing comma
                const currencyConversionString = chunk.map((currency) => `USD_${currency.code}`).join(',');
                chunkedArr.push(currencyConversionString);
            }

            /* In the case we have the chunk call the API to get the conversion rate */
            if (chunkedArr.length > 0) {
                const conversionRequests: Promise<any>[] = [];
                for (const row of chunkedArr) {
                    const currencyApiParams: HttpRequestInterface = {
                        method: 'GET',
                        url: `${process.env.CURR_RATE_API_URL}convert?q=${row}&compact=ultra&`,
                        apiKey: process.env.CURR_RATE_API_KEY as string,
                    };

                    conversionRequests.push(CommonHttpUtility.httpCurrencyConAPI(currencyApiParams));
                }

                /* Using promise to call all the API requests at once */
                const currencyResponse = await Promise.allSettled(conversionRequests);

                if (currencyResponse.length > 0) {
                    /* Store the data into currency table with respect to USD */
                    await this.currencyRepo.upsertUsdBaseRatesFromResponse(currencyResponse);
                }
            }

            // Generate currency JSON file after data is ensured/updated
            await this.generateCurrencyJsonFile();
        } catch (error) {
            throw error;
        }
    }

    /** [@Description: ]
     * @author: Mohit Soni at 19-09-2025 **/
    private async generateCurrencyJsonFile() {
        const currencies = await this.currencyRepo.getCurrencyData();

        const outputDir = join(process.cwd(), 'json');
        mkdirSync(outputDir, { recursive: true });

        const data: Record<
            string,
            {
                name: string;
                symbol: string;
                code: string;
                rate: number | string | null;
                symbol_placement: 'before' | 'after';
            }
        > = {};

        for (const curr of currencies || []) {
            const code = curr.code || '';
            if (!code) continue;

            const rate = code === 'USD' ? 1 : typeof curr.baseRateUSD === 'number' ? curr.baseRateUSD : ((curr.baseRateUSD as any) ?? null);

            data[code] = {
                name: curr.name,
                symbol: curr.symbol,
                code,
                rate,
                symbol_placement: curr.symbolPlacement as any,
            };
        }

        const filePath = join(outputDir, 'currency.json');
        writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
}
