import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * RequestType Enum for cancellation requests
 */
export enum RequestType {
    FullCancellation = 1,
    PartialCancellation = 2,
    Reissuance = 3,
}

/**
 * CancellationType Enum
 */
export enum CancellationType {
    NotSet = 0,
    NoShow = 1,
    FlightCancelled = 2,
    Others = 3,
}

/**
 * CancellationStatus Enum
 */
export enum CancellationStatus {
    NotSet = 0,
    Unassigned = 1,
    Assigned = 2,
    Acknowledged = 3,
    Completed = 4,
    Rejected = 5,
    Closed = 6,
    Pending = 7,
    Other = 8,
}

export class CancelFlightDto {
    @ApiProperty({
        description: 'Unique booking ID',
        example: '123456',
    })
    @IsNumber()
    @IsNotEmpty()
    bookingId: number;

    @ApiProperty({
        description: 'Request type values',
        example: 'FullCancellation',
        enum: ['FullCancellation', 'PartialCancellation', 'Reissuance', 'NotSet'],
    })
    @IsString()
    @IsNotEmpty()
    requestType: string;

    @ApiProperty({
        description: 'Remarks for cancellation (provider requires non-empty remarks)',
        example: 'Customer requested cancellation via portal',
        required: false,
    })
    @IsString()
    @IsOptional()
    remarks?: string;

    @ApiProperty({
        description: 'Cancellation type values',
        example: 'Others',
        enum: ['NotSet', 'NoShow', 'FlightCancelled', 'Others'],
        required: false,
    })
    @IsString()
    @IsOptional()
    cancellationType?: string;

    @ApiProperty({
        description: 'Array of ticket IDs (for partial cancellation)',
        example: [123456, 123457],
        required: false,
    })
    @IsArray()
    @IsNumber({}, { each: true })
    @IsOptional()
    ticketIds?: number[];

    

    @ApiProperty({
        description: 'Sectors for partial cancellation',
        type: () => [SectorDto],
        required: false,
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SectorDto)
    @IsOptional()
    sectors?: SectorDto[];

    @ApiProperty({
        description: 'Whether to release PNR (for hold bookings only)',
        example: false,
        required: false,
    })
    @IsOptional()
    releasePnr?: boolean;
}

/**
 * Sector DTO for partial cancellation
 */
export class SectorDto {
    @ApiProperty({
        description: 'Origin airport code',
        example: 'DEL',
    })
    @IsString()
    origin: string;

    @ApiProperty({
        description: 'Destination airport code',
        example: 'BOM',
    })
    @IsString()
    destination: string;
}

/**
 * DTO for releasing PNR (Passenger Name Record)
 * Note: Source is fetched from GetBookingDetails API response
 */
export class ReleasePNRRequestDto {
    @ApiProperty({
        description: 'End user IP address',
        example: '192.168.10.36',
    })
    @IsString()
    EndUserIp: string;

    @ApiProperty({
        description: 'Token ID for authentication',
        example: 'ebf966ff-9e72-4fc2-a63d-2236a91f7152',
    })
    @IsString()
    TokenId: string;

    @ApiProperty({
        description: 'Unique Booking ID',
        example: 1288527,
    })
    @IsNumber()
    BookingId: number;

    @ApiProperty({
        description: 'Airline source (fetched from GetBookingDetails API)',
        example: '4',
    })
    @IsString()
    Source: string;
}

/**
 * DTO for release PNR response
 */
export class ReleasePNRResponseDto {
    TraceId: string;
    ResponseStatus: number;
    Error?: {
        ErrorCode: number;
        ErrorMessage: string;
    };
}

/**
 * DTO for sending change request
 */
export class SendChangeRequestDto {
    @ApiProperty({ description: 'End user IP address' })
    EndUserIp: string;

    @ApiProperty({ description: 'Token ID for authentication' })
    TokenId: string;

    @ApiProperty({ description: 'Unique booking ID' })
    BookingId: number;

    @ApiProperty({ description: 'Request type: 1=Full, 2=Partial, 3=Reissuance' })
    RequestType: number;

    @ApiProperty({ description: 'Cancellation type: 0=NotSet, 1=NoShow, 2=FlightCancelled, 3=Others' })
    CancellationType: number;

    @ApiProperty({ description: 'Array of ticket IDs (comma-separated string or array)' })
    TicketId?: number[] | string;

    @ApiProperty({ description: 'Remarks for cancellation' })
    Remarks?: string;

    @ApiProperty({ description: 'Sectors for partial cancellation', required: false })
    Sectors?: Array<{
        Origin: string;
        Destination: string;
    }>;
}

/**
 * DTO for send change response
 */
export class SendChangeResponseDto {
    B2B2BStatus: boolean;
    TicketCRInfo: Array<{
        ChangeRequestId: number;
        TicketId: number;
        Status: number;
        Remarks: string;
        ChangeRequestStatus?: number;
        CancellationCharge?: number;
        RefundedAmount?: number;
        ServiceTaxOnRAF?: number;
        SwachhBharatCess?: number;
        KrishiKalyanCess?: number;
        CreditNoteNo?: string;
        CreditNoteCreatedOn?: string;
    }>;
    ResponseStatus: number;
    TraceId: string;
    Error?: {
        ErrorCode: number;
        ErrorMessage: string;
    };
}

/**
 * DTO for get change request status
 */
export class GetChangeRequestStatusRequestDto {
    @ApiProperty({ description: 'End user IP address' })
    EndUserIp: string;

    @ApiProperty({ description: 'Token ID for authentication' })
    TokenId: string;

    @ApiProperty({ description: 'Change request ID from SendChangeRequest response' })
    ChangeRequestId: number;
}

/**
 * DTO for get change request status response
 */
export class GetChangeRequestStatusResponseDto {
    ResponseStatus: number;
    TraceId: string;
    Error?: {
        ErrorCode: number;
        ErrorMessage: string;
    };
    ChangeRequestId: number;
    RefundedAmount: number;
    CancellationCharge: number;
    ServiceTaxOnRAF: number;
    ChangeRequestStatus: number;
}

/**
 * DTO for cancellation charges request
 */
export class GetCancellationChargesRequestDto {
    @ApiProperty({ description: 'End user IP address' })
    EndUserIp: string;

    @ApiProperty({ description: 'Token ID for authentication' })
    TokenId: string;

    @ApiProperty({ description: 'Request type (1 for full cancellation)' })
    RequestType: number;

    @ApiProperty({ description: 'Unique booking ID received in Ticket Response' })
    BookingId: number;

    @ApiProperty({ description: 'Booking mode (5 for API)', required: false })
    BookingMode?: number;
}

/**
 * Simplified DTO for cancellation charges request (only required fields)
 */
export class GetCancellationChargesDto {
    @ApiProperty({
        description: 'Unique booking ID',
        example: 123456,
    })
    @IsNumber()
    @IsNotEmpty()
    bookingId: number;

    @ApiProperty({
        description: 'Request type',
        example: 'FullCancellation',
        enum: ['FullCancellation', 'PartialCancellation', 'Reissuance'],
    })
    @IsString()
    @IsNotEmpty()
    requestType: string;
}

/**
 * DTO for cancellation charges response
 */
export class GetCancellationChargesResponseDto {
    ResponseStatus: number;
    TraceId: string;
    RefundAmount: number;
    CancellationCharge: number;
    Remarks: string;
    Currency: string;
    Error?: {
        ErrorCode: number;
        ErrorMessage: string;
    };
}

