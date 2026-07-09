import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum CancelMode {
    Flight = 'flight',
    Hotel = 'hotel',
}

export enum RequestType {
    FullCancellation = 1,
    PartialCancellation = 2,
    Reissuance = 3,
}

export enum CancellationType {
    NotSet = 0,
    NoShow = 1,
    FlightCancelled = 2,
    Others = 3,
}

export class SectorDto {
    @ApiProperty({ description: 'Origin airport code', example: 'DEL' })
    @IsString()
    origin: string;

    @ApiProperty({ description: 'Destination airport code', example: 'BOM' })
    @IsString()
    destination: string;
}


export class SupplierParamsDto {
    @ApiProperty({ description: 'Remarks for cancellation', example: 'Customer requested cancellation via portal', required: false })
    @IsString()
    @IsOptional()
    remarks?: string;

    @ApiProperty({ description: 'Cancellation type', example: 'Others', enum: ['NotSet', 'NoShow', 'FlightCancelled', 'Others'], required: false })
    @IsString()
    @IsOptional()
    cancellationType?: string;

    @ApiProperty({ description: 'Array of ticket IDs (for partial cancellation)', example: [123456, 123457], required: false })
    @IsArray()
    @IsNumber({}, { each: true })
    @IsOptional()
    ticketIds?: number[];

    @ApiProperty({ description: 'Sectors for partial cancellation', type: () => [SectorDto], required: false })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SectorDto)
    @IsOptional()
    sectors?: SectorDto[];

    @ApiProperty({ description: 'Whether to release PNR (for hold bookings only)', example: false, required: false })
    @IsOptional()
    releasePnr?: boolean;

    @IsString()
    @IsOptional()
    providerCode?: string;
}


export class GenericCancelDto {
    @ApiProperty({ description: 'Cancellation mode', enum: CancelMode, example: CancelMode.Flight })
    @IsEnum(CancelMode)
    mode: CancelMode;

    @ApiProperty({ description: 'TBO supplier booking id', example: 2131696 })
    @IsNumber()
    @IsNotEmpty()
    bookingId: number;

    @ApiProperty({
        description: 'Internal booking UUID (DB lookup only, not sent to TBO)',
        example: '2b52fc08-fde0-43e4-9f34-b9d65b1b00b5',
    })
    @IsString()
    @IsNotEmpty()
    booking_id: string;

    @ApiProperty({ description: 'Request type', example: 'FullCancellation', enum: ['FullCancellation', 'PartialCancellation', 'Reissuance', 'NotSet'] })
    @IsString()
    @IsNotEmpty()
    requestType: string;

    @ApiProperty({ description: 'Supplier-specific parameters (varies by provider)', required: false, type: () => SupplierParamsDto })
    @ValidateNested()
    @Type(() => SupplierParamsDto)
    @IsOptional()
    supplierParams?: SupplierParamsDto;

    @ApiProperty({
        description: 'Alias for supplierParams.sectors (partial cancellation only). Prefer supplierParams.sectors.',
        type: () => [SectorDto],
        required: false,
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SectorDto)
    @IsOptional()
    segments?: SectorDto[];

    @ApiProperty({
        description: 'Hotel only: max GetChangeRequestStatus polls before returning pendingCompletion (from payment service)',
        example: 5,
        required: false,
    })
    @IsNumber()
    @IsOptional()
    pollMaxAttempts?: number;

    @ApiProperty({
        description: 'Hotel only: delay between status polls in ms',
        example: 6000,
        required: false,
    })
    @IsNumber()
    @IsOptional()
    pollIntervalMs?: number;

    @ApiProperty({
        description: 'Hotel only: wall-clock cap for status polling in ms (optional)',
        example: 30000,
        required: false,
    })
    @IsNumber()
    @IsOptional()
    pollTimeoutMs?: number;
}

export class GenericGetCancellationChargesDto {
    @ApiProperty({ description: 'Cancellation mode', enum: CancelMode, example: CancelMode.Flight })
    @IsEnum(CancelMode)
    mode: CancelMode;

    @ApiProperty({ description: 'TBO supplier booking id', example: 2131696 })
    @IsNumber()
    @IsNotEmpty()
    bookingId: number;

    @ApiProperty({
        description: 'Internal booking UUID (DB lookup only, not sent to TBO)',
        example: '2b52fc08-fde0-43e4-9f34-b9d65b1b00b5',
    })
    @IsString()
    @IsNotEmpty()
    booking_id: string;

    @ApiProperty({ description: 'Request type', example: 'FullCancellation', enum: ['FullCancellation', 'PartialCancellation', 'Reissuance'] })
    @IsString()
    @IsNotEmpty()
    requestType: string;

    @ApiProperty({
        description: 'Required for PartialCancellation: sectors or ticketIds. Ignored for FullCancellation.',
        required: false,
        type: () => SupplierParamsDto,
    })
    @ValidateNested()
    @Type(() => SupplierParamsDto)
    @IsOptional()
    supplierParams?: SupplierParamsDto;

    @ApiProperty({
        description: 'Alias for supplierParams.sectors (partial cancellation only). Prefer supplierParams.sectors.',
        type: () => [SectorDto],
        required: false,
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SectorDto)
    @IsOptional()
    segments?: SectorDto[];
}


