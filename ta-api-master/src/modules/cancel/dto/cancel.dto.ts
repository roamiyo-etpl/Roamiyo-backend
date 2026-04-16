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

    @ApiProperty({ description: 'Unique booking ID', example: 123456 })
    @IsNumber()
    @IsNotEmpty()
    bookingId: number;

    @ApiProperty({ description: 'Request type', example: 'FullCancellation', enum: ['FullCancellation', 'PartialCancellation', 'Reissuance', 'NotSet'] })
    @IsString()
    @IsNotEmpty()
    requestType: string;

    @ApiProperty({ description: 'Supplier-specific parameters (varies by provider)', required: false, type: () => SupplierParamsDto })
    @ValidateNested()
    @Type(() => SupplierParamsDto)
    @IsOptional()
    supplierParams?: SupplierParamsDto;
}

export class GenericGetCancellationChargesDto {
    @ApiProperty({ description: 'Cancellation mode', enum: CancelMode, example: CancelMode.Flight })
    @IsEnum(CancelMode)
    mode: CancelMode;

    @ApiProperty({ description: 'Unique booking ID', example: 123456 })
    @IsNumber()
    @IsNotEmpty()
    bookingId: number;

    @ApiProperty({ description: 'Request type', example: 'FullCancellation', enum: ['FullCancellation', 'PartialCancellation', 'Reissuance'] })
    @IsString()
    @IsNotEmpty()
    requestType: string;
}


