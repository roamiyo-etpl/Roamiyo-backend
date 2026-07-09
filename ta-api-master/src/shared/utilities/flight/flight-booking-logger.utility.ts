import { Logger } from '@nestjs/common';

const logger = new Logger('FlightBooking');

function isDebugEnabled(): boolean {
  return (
    process.env.FLIGHT_BOOKING_DEBUG === 'true' ||
    process.env.LOG_LEVEL === 'debug' ||
    process.env.NODE_ENV !== 'production'
  );
}

export function flightBookingDebug(message: string, context?: unknown): void {
  if (!isDebugEnabled()) return;
  if (context === undefined) {
    logger.debug(message);
    return;
  }
  if (typeof context === 'string') {
    logger.debug(`${message} ${context}`);
    return;
  }
  logger.debug(`${message} ${JSON.stringify(context)}`);
}

export function flightBookingWarn(message: string, context?: unknown): void {
  if (context === undefined) {
    logger.warn(message);
    return;
  }
  logger.warn(`${message} ${typeof context === 'string' ? context : JSON.stringify(context)}`);
}
