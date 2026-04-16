export interface CurrencyJsonEntry {
    name: string;
    symbol: string;
    code: string;
    rate: number | string | null;
    symbol_placement: 'before' | 'after';
}

export interface CurrencyConversionResult {
    rate: number;
    convertedAmount: number;
    currencyFrom: string;
    currencyTo: string;
    currencyString: string;
}
