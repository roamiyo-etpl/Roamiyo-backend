import { BadRequestException, HttpException } from '@nestjs/common';

/**
 * Extracts a human-readable message for hotel API failures so payment/aggregator
 * can show the real reason instead of generic ERR_* / "Internal server error".
 */
export function extractHotelErrorMessage(error: unknown, fallback: string): string {
    if (error == null) {
        return fallback;
    }

    if (typeof error === 'string' && error.trim()) {
        return error;
    }

    if (error instanceof HttpException) {
        const response = error.getResponse();
        const fromResponse = messageFromUnknown(response);
        if (fromResponse) {
            return fromResponse;
        }
        return error.message || fallback;
    }

    if (typeof error === 'object') {
        const err = error as Record<string, unknown>;

        const fromNestedResponse = messageFromUnknown(err.response);
        if (fromNestedResponse) {
            return fromNestedResponse;
        }

        const tboError = err.Error as { ErrorMessage?: string } | undefined;
        if (tboError?.ErrorMessage) {
            return String(tboError.ErrorMessage);
        }

        if (typeof err.message === 'string' && err.message.trim()) {
            return err.message;
        }
    }

    return fallback;
}

export function throwHotelApiError(error: unknown, fallback: string): never {
    if (error instanceof HttpException) {
        throw error;
    }

    throw new BadRequestException({
        success: false,
        message: extractHotelErrorMessage(error, fallback),
    });
}

function messageFromUnknown(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) {
        return value;
    }

    if (!value || typeof value !== 'object') {
        return undefined;
    }

    const obj = value as Record<string, unknown>;
    const message = obj.message;

    if (typeof message === 'string' && message.trim()) {
        return message;
    }

    if (Array.isArray(message)) {
        const joined = message.filter((item) => typeof item === 'string' && item.trim()).join(', ');
        return joined || undefined;
    }

    if (message && typeof message === 'object') {
        const nested = (message as Record<string, unknown>).message;
        if (typeof nested === 'string' && nested.trim()) {
            return nested;
        }
    }

    return undefined;
}
