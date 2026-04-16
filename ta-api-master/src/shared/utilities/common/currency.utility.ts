import { readFileSync } from 'fs';
import { join } from 'path';
import { CurrencyConversionResult, CurrencyJsonEntry } from 'src/shared/interfaces/currency.interface';

export class CurrencyUtility {
    static convertCurrency(params: { currencyFrom: string; currencyTo: string; amount: number }): CurrencyConversionResult {
        const { currencyFrom, currencyTo, amount } = params;

        if (typeof amount !== 'number' || !isFinite(amount)) {
            throw new Error('Amount must be a finite number');
        }

        // Read currency map on demand to always use latest generated JSON
        const filePath = join(process.cwd(), 'json', 'currency.json');
        const map = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, CurrencyJsonEntry>;

        const fromCode = currencyFrom || '';
        const toCode = currencyTo || '';

        const fromIsUSD = fromCode.toUpperCase() === 'USD';
        const toIsUSD = toCode.toUpperCase() === 'USD';

        const fromEntry = fromIsUSD ? null : (map[fromCode] ?? map[fromCode.toUpperCase()]);
        const toEntry = toIsUSD ? null : (map[toCode] ?? map[toCode.toUpperCase()]);

        const fromRate = fromIsUSD ? 1 : Number(fromEntry?.rate);
        const toRate = toIsUSD ? 1 : Number(toEntry?.rate);

        if (!fromIsUSD && (!fromEntry || !isFinite(fromRate) || fromRate <= 0)) {
            throw new Error(`Unsupported or invalid currencyFrom: ${currencyFrom}`);
        }
        if (!toIsUSD && (!toEntry || !isFinite(toRate) || toRate <= 0)) {
            throw new Error(`Unsupported or invalid currencyTo: ${currencyTo}`);
        }

        const rate = toRate / fromRate;
        const convertedAmount = amount * rate;

        return {
            rate,
            convertedAmount: Number(convertedAmount.toFixed(2)),
            currencyFrom,
            currencyTo,
            currencyString: '',
        };
    }
}
