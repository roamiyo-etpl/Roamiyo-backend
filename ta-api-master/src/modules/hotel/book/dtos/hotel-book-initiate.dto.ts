import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsNumber, IsOptional, IsArray, ValidateNested, Min, Max, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { GenderEnum, TitleEnum } from 'src/shared/enums/accounts.enum';

export class PassengerDto {
    @ApiProperty({
        description: 'Passenger id from client',
        example: '6f1c0b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f',
        required: false,
    })
    @IsOptional()
    @IsString()
    id?: string;

    @ApiProperty({
        description: 'Lead passenger of the room. If not sent for a room, the first adult of that room is used as lead.',
        example: true,
        required: false,
    })
    @IsOptional()
    @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
    @IsBoolean()
    LeadPassenger?: boolean;

    @ApiProperty({
        description: 'Passenger type (adult, child, infant)',
        example: 'adult',
    })
    @IsNotEmpty()
    @IsString()
    type!: 'adult' | 'child' | 'infant';

    @ApiProperty({
        description: 'Passenger title (Mr, Miss, Mrs, Ms)',
        example: 'Mr',
    })
    @IsNotEmpty()
    @IsString()
    title!: string;

    @ApiProperty({
        description: 'Passenger roomId (1,2,3)',
        example: 1,
    })
    @IsNotEmpty()
    @IsNumber()
    roomId!: number;

    @ApiProperty({
        description: 'Passenger age (required for child/infant)',
        example: 25,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(120)
    age?: number;

    @ApiProperty({
        description: 'First name',
        example: 'John',
    })
    @IsNotEmpty()
    @IsString()
    firstName!: string;

    @ApiProperty({
        description: 'middle name',
        example: 'John',
        required: false,
    })
    @IsOptional()
    @IsString()
    middleName?: string;

    @ApiProperty({
        description: 'Last name',
        example: 'Doe',
    })
    @IsNotEmpty()
    @IsString()
    lastName!: string;

    @ApiProperty({
        description: 'Email address',
        example: 'john.doe@example.com',
        required: false,
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({
        description: 'Date of birth',
        example: '2002-02-20',
        required: false,
    })
    @IsOptional()
    @IsString()
    dob?: string;

    @ApiProperty({
        description: 'dial Code',
        example: '+91',
        required: false,
    })
    @IsOptional()
    @IsString()
    dialCode?: string;

    @ApiProperty({
        description: 'Phone number',
        example: '+1234567890',
        required: false,
    })
    @IsOptional()
    @IsString()
    mobileNo?: string;

    @ApiProperty({
        description: 'Nationality code',
        example: 'IN',
        required: false,
    })
    @IsOptional()
    @IsString()
    nationality?: string;

    @ApiProperty({
        description: 'In case of pax is providing PAN then we will consider only pax pan and Parent/Guardian details will be discarded. If pax PAN is incorrect then booking will be failed',
        example: 'CAMPA9865C',
        required: false,
    })
    @IsOptional()
    @IsString()
    pan?: string;

    @ApiProperty({
        description: 'In case of pax is providing passport then we will consider only pax passport and Parent/Guardian details will be discarded. If pax passport is incorrect then booking will be failed',
        example: 'M736352',
        required: false,
    })
    @IsOptional()
    @IsString()
    passportNumber?: string;

    @ApiProperty({
        description: 'Passport issue date a valid date',
        example: '2025-11-02T00:00:00Z',
        required: false,
    })
    @IsOptional()
    @IsString()
    passportIssueDate?: string;

    @ApiProperty({
        description: 'Passport expiry date (must be after check-out date)',
        example: '2025-11-02T00:00:00Z',
        required: false,
    })
    @IsOptional()
    @IsString()
    passportExpDate?: string;

    @ApiProperty({
        description: 'Nationality code',
        example: 'IN',
        required: false,
    })
    @IsOptional()
    @IsString()
    passportIssuingCountry?: string;

    @ApiProperty({
        description: 'Document type from client (PAN / Passport). Mapped to pan or passportNumber when present.',
        example: 'PAN',
        required: false,
    })
    @IsOptional()
    @IsString()
    documentType?: string;

    @ApiProperty({
        description: 'Document number from client. Used with documentType to populate pan or passportNumber.',
        example: 'APAPY3078A',
        required: false,
    })
    @IsOptional()
    @IsString()
    documentNumber?: string;
}

export class PaymentDetailsDto {
    @ApiProperty({
        description: 'Payment gateway name',
        example: 'stripe',
    })
    @IsNotEmpty()
    @IsString()
    gatewayName!: string;

    @ApiProperty({
        description: 'Payment type',
        example: 'credit_card',
    })
    @IsNotEmpty()
    @IsString()
    paymentType!: string;

    @ApiProperty({
        description: 'Amount',
        example: 360.00,
    })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    totalAmount!: number;

    @ApiProperty({
        description: 'Cash amount',
        example: 360.00,
    })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    cashAmount!: number;

    @ApiProperty({
        description: 'Price hash key',
        example: 'price_hash_key',
    })
    @IsNotEmpty()
    @IsString()
    priceHashKey!: string;

    @ApiProperty({
        description: 'Payment token',
        example: 'tok_1234567890abcdef',
    })
    @IsNotEmpty()
    @IsString()
    paymentToken!: string;

    @ApiProperty({
        description: 'Payment log ID',
        example: 'log_1234567890abcdef',
    })
    @IsNotEmpty()
    @IsString()
    paymentLogId!: string;
}

export class ContactDetailsDto {
    @ApiProperty({
        description: 'User title Mr, Miss, and Mrs',
        example: 'Mr',
        required: false,
    })
    @IsOptional()
    @IsEnum(TitleEnum)
    title?: TitleEnum;

    @ApiProperty({
        description: 'First name',
        example: 'John',
    })
    @IsNotEmpty()
    @IsString()
    firstName!: string;

    @ApiProperty({
        description: 'middle name',
        example: 'John',
        required: false
    })
    @IsOptional()
    @IsString()
    middleName?: string;

    @ApiProperty({
        description: 'Last name',
        example: 'Doe',
    })
    @IsNotEmpty()
    @IsString()
    lastName!: string;

    @ApiProperty({
        description: 'Contact person/user gender male, female and other',
        example: 'male',
        required: false,
    })
    @IsOptional()
    @IsEnum(GenderEnum)
    gender?: GenderEnum;

    @ApiProperty({
        description: 'Email address',
        example: 'john.doe@example.com',
    })
    @IsNotEmpty()
    @IsEmail()
    email!: string;

    @ApiProperty({
        description: 'Dialer Code as country wise',
        example: '+91',
    })
    @IsNotEmpty()
    @IsString()
    dialCode!: string;

    @ApiProperty({
        description: 'Phone number',
        example: '+1234567890',
    })
    @IsNotEmpty()
    @IsString()
    mobileNo!: string;

    @ApiProperty({
        description: 'Address line 1',
        example: '123 Main Street',
        required: false,
    })
    @IsOptional()
    @IsString()
    addressLine1?: string;

    @ApiProperty({
        description: 'Address line 2',
        example: 'Apt 4B',
        required: false,
    })
    @IsOptional()
    @IsString()
    addressLine2?: string;

    @ApiProperty({
        description: 'City',
        example: 'New York',
        required: false,
    })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiProperty({
        description: 'State',
        example: 'NY',
        required: false,
    })
    @IsOptional()
    @IsString()
    state?: string;

    @ApiProperty({
        description: 'Country',
        example: 'United States',
        required: false,
    })
    @IsOptional()
    @IsString()
    country?: string;

    @ApiProperty({
        description: 'Postal code',
        example: '10001',
        required: false,
    })
    @IsOptional()
    @IsString()
    postalCode?: string;

    @ApiProperty({
        description: 'Nationality code. Saved in contact country column.',
        example: 'IN',
        required: false,
    })
    @IsOptional()
    @IsString()
    nationality?: string;
}

export class BookRoomDto {
    @ApiProperty({ description: 'Room id', example: 1, required: false })
    @IsOptional()
    @IsNumber()
    roomId?: number;

    @ApiProperty({ description: 'Number of adults', example: 2, required: false })
    @IsOptional()
    @IsNumber()
    adults?: number;

    @ApiProperty({ description: 'Child ages', example: [5], required: false })
    @IsOptional()
    @IsArray()
    childAges?: number[];
}

export class HotelBookInitiateDto {
    @ApiProperty({
        description: 'Hotel ID',
        example: '1863197',
    })
    @IsNotEmpty()
    @IsString()
    hotelId!: string;

    @ApiProperty({
        description: 'Supplier code',
        example: 'TBO',
    })
    @IsNotEmpty()
    @IsString()
    supplierCode!: string;

    @ApiProperty({
        description: 'Search request ID from previous search',
        example: 'search_req_12345',
    })
    @IsNotEmpty()
    @IsString()
    searchReqId!: string;

    @ApiProperty({
        description: 'Unique booking identifier',
        example: 'booking_12345',
    })
    @IsNotEmpty()
    @IsString()
    rateKey!: string;

    @ApiProperty({
        description: 'Check-in date (YYYY-MM-DD)',
        example: '2026-05-15',
    })
    @IsNotEmpty()
    @IsDateString()
    checkIn!: string;

    @ApiProperty({
        description: 'Check-out date (YYYY-MM-DD)',
        example: '2026-05-16',
    })
    @IsNotEmpty()
    @IsDateString()
    checkOut!: string;

    @ApiProperty({
        description: 'Room occupancy used by aggregator. Not used by this API.',
        type: [BookRoomDto],
        required: false,
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BookRoomDto)
    rooms?: BookRoomDto[];

    @ApiProperty({
        description: 'Passenger details',
        type: [PassengerDto],
        example: [
            {
                type: 'adult',
                title: 'Mr',
                roomId: 1,
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                dialCode: '+123',
                mobileNo: '9627000000',
                nationality: 'US',
                pan: 'CAMPA7654C'
            }
        ],
    })
    @IsNotEmpty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PassengerDto)
    passengers!: PassengerDto[];

    @ApiProperty({
        description: 'Payment details',
        type: PaymentDetailsDto,
    })
    @IsNotEmpty()
    @ValidateNested()
    @Type(() => PaymentDetailsDto)
    paymentDetails!: PaymentDetailsDto;

    @ApiProperty({
        description: 'Contact details',
        type: ContactDetailsDto,
    })
    @IsNotEmpty()
    @ValidateNested()
    @Type(() => ContactDetailsDto)
    contactDetails!: ContactDetailsDto;
}
