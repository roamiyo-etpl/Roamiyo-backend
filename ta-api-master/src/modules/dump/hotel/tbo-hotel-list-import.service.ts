import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parse } from 'csv-parse';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { CommonResponse } from 'src/shared/interfaces/common-response.interface';
import { PropertyTypeEnum, TboHotelListEntity } from './entities/tbo-hotel-list.entity';

// CSV files placed in <project root>/dump; homestays run last so they win if an id is in both files
const IMPORT_FILES: { fileName: string; propertyType: PropertyTypeEnum }[] = [
    { fileName: 'tbo_hotels.csv', propertyType: PropertyTypeEnum.HOTEL },
    { fileName: 'tbo_homestays.csv', propertyType: PropertyTypeEnum.HOMESTAY },
];

// CSV header -> entity property
const COLUMN_MAP: Record<string, keyof TboHotelListEntity> = {
    TBOHOTELID: 'tboHotelId',
    HOTELNAME: 'hotelName',
    ADDRESSLINE1: 'addressLine1',
    ADDRESSLINE2: 'addressLine2',
    CITYID_NEW: 'cityId',
    CITYNAME: 'cityName',
    COUNTRYNAME: 'countryName',
    COUNTRYCODE: 'countryCode',
    LATITUDE: 'latitude',
    LONGITUDE: 'longitude',
    STARRATING: 'starRating',
};

const STAR_WORDS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7 };

// 13 columns per row keeps us well under Postgres' 65535 bind parameter limit
const BATCH_SIZE = 1000;

interface FileImportSummary {
    fileName: string;
    propertyType: PropertyTypeEnum;
    status: 'imported' | 'not_found';
    totalRows: number;
    upserted: number;
    skipped: number;
}

/**
 * Imports TBO hotel / homestay CSV files from the dump folder into tbo_hotel_list
 */
@Injectable()
export class TboHotelListImportService {
    private readonly logger = new Logger(TboHotelListImportService.name);
    private readonly dumpDir = join(process.cwd(), 'dump');
    private isRunning = false;

    constructor(
        @InjectRepository(TboHotelListEntity)
        private readonly tboHotelListRepository: Repository<TboHotelListEntity>,
    ) {}

    /**
     * Read tbo_hotels.csv and tbo_homestays.csv from the dump folder and upsert by TBOHOTELID
     * @returns Promise<CommonResponse> - Import summary per file
     */
    async importHotelList(): Promise<CommonResponse> {
        if (this.isRunning) {
            throw new ConflictException('Hotel list import is already running');
        }

        const available = IMPORT_FILES.filter((file) => existsSync(join(this.dumpDir, file.fileName)));
        if (available.length === 0) {
            throw new BadRequestException(`No files found. Place ${IMPORT_FILES.map((f) => f.fileName).join(' and/or ')} in ${this.dumpDir}`);
        }

        this.isRunning = true;
        const startTime = Date.now();
        try {
            const files: FileImportSummary[] = [];
            for (const file of IMPORT_FILES) {
                if (!available.includes(file)) {
                    files.push({ ...file, status: 'not_found', totalRows: 0, upserted: 0, skipped: 0 });
                    continue;
                }
                files.push(await this.importFile(file.fileName, file.propertyType));
            }

            const upserted = files.reduce((sum, f) => sum + f.upserted, 0);
            const timeTaken = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
            this.logger.log(`TBO hotel list import done: ${upserted} upserted in ${timeTaken}`);

            return {
                success: true,
                message: `${upserted} records inserted/updated successfully`,
                data: { files, timeTaken },
            };
        } catch (error) {
            this.logger.error('Error in importHotelList:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException(`Failed to import hotel list: ${error.message}`);
        } finally {
            this.isRunning = false;
        }
    }

    private async importFile(fileName: string, propertyType: PropertyTypeEnum): Promise<FileImportSummary> {
        const summary: FileImportSummary = { fileName, propertyType, status: 'imported', totalRows: 0, upserted: 0, skipped: 0 };

        const parser = createReadStream(join(this.dumpDir, fileName)).pipe(
            parse({
                bom: true,
                columns: (headers: string[]) => headers.map((h) => COLUMN_MAP[h.toUpperCase().replace(/\s+/g, '')] ?? false),
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true,
                relax_quotes: true,
            }),
        );

        // keyed by hotel id so duplicates within a batch don't break ON CONFLICT
        let batch = new Map<string, Partial<TboHotelListEntity>>();
        let headerChecked = false;

        for await (const record of parser as AsyncIterable<Record<string, string>>) {
            if (!headerChecked) {
                if (!('tboHotelId' in record)) {
                    throw new BadRequestException(`${fileName}: TBOHOTELID column not found. Expected columns: ${Object.keys(COLUMN_MAP).join(', ')}`);
                }
                headerChecked = true;
            }

            summary.totalRows++;
            const hotel = this.mapRecord(record, propertyType);
            if (!hotel) {
                summary.skipped++;
                continue;
            }
            batch.set(hotel.tboHotelId!, hotel);

            if (batch.size >= BATCH_SIZE) {
                summary.upserted += await this.upsertBatch([...batch.values()]);
                batch = new Map();
            }
        }

        if (batch.size > 0) {
            summary.upserted += await this.upsertBatch([...batch.values()]);
        }

        this.logger.log(`${fileName} (${propertyType}): ${summary.upserted} upserted, ${summary.skipped} skipped, ${summary.totalRows} rows`);
        return summary;
    }

    private mapRecord(record: Record<string, string>, propertyType: PropertyTypeEnum): Partial<TboHotelListEntity> | null {
        const value = (key: keyof TboHotelListEntity): string | null => record[key as string] || null;
        // a few TBO rows have several rows merged into one cell - clip to the varchar length instead of failing the batch
        const clipped = (key: keyof TboHotelListEntity, maxLength: number): string | null => value(key)?.slice(0, maxLength) ?? null;

        const tboHotelId = value('tboHotelId');
        if (!tboHotelId) {
            return null;
        }

        return {
            tboHotelId,
            hotelName: clipped('hotelName', 500),
            addressLine1: value('addressLine1'),
            addressLine2: value('addressLine2'),
            cityId: clipped('cityId', 50),
            cityName: clipped('cityName', 150),
            countryName: clipped('countryName', 150),
            countryCode: clipped('countryCode', 10)?.toUpperCase() ?? null,
            latitude: this.parseCoordinate(value('latitude'), 90),
            longitude: this.parseCoordinate(value('longitude'), 180),
            starRating: this.parseStarRating(value('starRating')),
            propertyType,
            updatedAt: new Date(),
        };
    }

    private async upsertBatch(hotels: Partial<TboHotelListEntity>[]): Promise<number> {
        await this.tboHotelListRepository.upsert(hotels, { conflictPaths: ['tboHotelId'], skipUpdateIfNoValuesChanged: false });
        return hotels.length;
    }

    private parseCoordinate(value: string | null, limit: number): number | null {
        if (!value) {
            return null;
        }
        const num = Number(value);
        return Number.isFinite(num) && Math.abs(num) <= limit ? num : null;
    }

    /** Handles "4", "4.5", "4 Star", "FourStar" etc. - half stars round down */
    private parseStarRating(value: string | null): number | null {
        if (!value) {
            return null;
        }
        const numeric = value.match(/\d+(\.\d+)?/);
        if (numeric) {
            const rating = Math.floor(parseFloat(numeric[0]));
            return rating >= 0 && rating <= 7 ? rating : null;
        }
        const word = Object.keys(STAR_WORDS).find((key) => value.toUpperCase().startsWith(key));
        return word ? STAR_WORDS[word] : null;
    }
}
