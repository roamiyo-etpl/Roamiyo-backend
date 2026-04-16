import { Module } from '@nestjs/common';
import { HotelDumpModule } from './hotel/hotel-dump.module';
import { GeographyDumpModule } from './geography/geography-dump.module';

/**
 * Dump module - handles data dump operations for hotels and geography
 * @author Prashant - TBO Integration
 */
@Module({
    imports: [HotelDumpModule, GeographyDumpModule],
    exports: [HotelDumpModule, GeographyDumpModule],
})
export class DumpModule {}
