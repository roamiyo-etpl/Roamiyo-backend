import { IsArray, IsNotEmpty, ValidateNested, IsDateString, IsString, IsOptional, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RouteDetails {
    @ApiProperty({
        description: 'Airline code',
        example: 'AA',
    })
    @IsNotEmpty()
    @IsString()
    airline: string;

    @ApiProperty({
        description: 'Departure airport code',
        example: 'LGA',
    })
    @IsNotEmpty()
    @IsString()
    departureCode: string;

    @ApiProperty({
        description: 'Departure date',
        example: '2026-01-15',
        format: 'date',
    })
    @IsNotEmpty()
    @IsDateString()
    departureDate: string;

    @ApiProperty({
        description: 'Departure time',
        example: '09:29 AM',
    })
    @IsNotEmpty()
    @IsString()
    departureTime: string;

    @ApiProperty({
        description: 'Arrival airport code',
        example: 'ORD',
    })
    @IsNotEmpty()
    @IsString()
    arrivalCode: string;

    @ApiProperty({
        description: 'Arrival date',
        example: '2026-01-15',
        format: 'date',
    })
    @IsNotEmpty()
    @IsDateString()
    arrivalDate: string;

    @ApiProperty({
        description: 'Arrival time',
        example: '11:10 AM',
    })
    @IsNotEmpty()
    @IsString()
    arrivalTime: string;

    @ApiProperty({
        description: 'Booking class code',
        example: 'Q',
    })
    @IsString()
    bookingCode: string;

    @ApiProperty({
        description: 'Flight number',
        example: '3234',
    })
    @IsNotEmpty()
    @IsString()
    flightNum: string;
}

// Routes class removed - routes is now directly RouteDetails[][]

export class Document {
    @ApiProperty({
        description: 'Type of travel document',
        example: 'P',
        enum: ['P', 'N', 'D'],
    })
    @IsNotEmpty()
    @IsString()
    documentType: string;

    @ApiProperty({
        description: 'Document number',
        example: 'A1234567',
    })
    @IsNotEmpty()
    @IsString()
    documentNumber: string;

    @ApiProperty({
        description: 'Document expiry date',
        example: '2030-12-31',
        format: 'date',
    })
    @IsNotEmpty()
    @IsDateString()
    expiryDate: string;

    @ApiProperty({
        description: 'Country that issued the document',
        example: 'US',
    })
    @IsNotEmpty()
    @IsString()
    country: string;
}

export class PassengerDetail {
    @ApiProperty({
        description: 'Passenger title',
        example: 'Mr',
        enum: ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'],
    })
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiProperty({
        description: 'Passenger first name',
        example: 'John',
    })
    @IsNotEmpty()
    @IsString()
    firstName: string;

    @ApiProperty({
        description: 'Passenger middle name',
        example: '',
    })
    @IsOptional()
    @IsString()
    middleName?: string;

    @ApiProperty({
        description: 'Passenger last name',
        example: 'Doe',
    })
    @IsNotEmpty()
    @IsString()
    lastName: string;
}

export class Passenger {
    @ApiProperty({
        description: 'Type of passenger',
        example: 'ADT',
        enum: ['ADT', 'CHD', 'INF'],
    })
    @IsNotEmpty()
    @IsString()
    passengerType: string;

    @ApiProperty({
        description: 'Passenger gender',
        example: 'M',
        enum: ['M', 'F'],
    })
    @IsNotEmpty()
    @IsString()
    gender: string;

    @ApiProperty({
        description: 'Passenger personal details',
        type: PassengerDetail,
        example: {
            title: 'Mr',
            firstName: 'John',
            middleName: 'Doe',
            lastName: 'Doe',
        },
    })
    @ValidateNested()
    @Type(() => PassengerDetail)
    passengerDetail: PassengerDetail;

    @ApiProperty({
        description: 'Passenger date of birth',
        example: '1990-01-15',
        format: 'date',
    })
    @IsNotEmpty()
    @IsString()
    dateOfBirth: string;

    @ApiPropertyOptional({
        description: 'Travel document information',
        type: Document,
        example: {
            documentType: 'Passport',
            documentNumber: 'A1234567',
            expiryDate: '2030-12-31',
            country: 'US',
        },
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => Document)
    document?: Document;

    @ApiProperty({
        description: 'Passenger nationality',
        example: 'US',
    })
    @IsNotEmpty()
    @IsString()
    nationality: string;

    @ApiProperty({
        description: 'Passenger mobile number',
        example: '1234567890',
    })
    @IsNotEmpty()
    @IsString()
    mobile: string;

    @ApiProperty({
        description: 'Mobile country code',
        example: '+1',
    })
    @IsString()
    mobileCountryCode: string;
}

export class ContactInfo {
    @ApiPropertyOptional({
        description: 'Contact person title',
        example: 'Mr',
        enum: ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'],
    })
    @IsOptional()
    @IsString()
    title: string;

    @ApiProperty({
        description: 'Contact person name',
        example: 'John',
    })
    @IsNotEmpty()
    @IsString()
    firstName: string;

    @ApiProperty({
        description: 'Contact person middle name',
        example: 'Doe',
    })
    @IsOptional()
    @IsString()
    middleName?: string;

    @ApiProperty({
        description: 'Contact person last name',
        example: 'Doe',
    })
    @IsNotEmpty()
    @IsString()
    lastName: string;

    @ApiProperty({
        description: 'Contact person gender',
        example: 'M',
        enum: ['M', 'F'],
    })
    @IsNotEmpty()
    @IsString()
    gender: string;

    @ApiProperty({
        description: 'Contact email address',
        example: 'john.doe@example.com',
        format: 'email',
    })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'Contact mobile number',
        example: '1234567890',
    })
    @IsNotEmpty()
    @IsString()
    mobile: string;

    @ApiProperty({
        description: 'Mobile country code',
        example: '+1',
    })
    @IsNotEmpty()
    @IsString()
    mobileCountryCode: string;

    @ApiProperty({
        description: 'Postal/ZIP code',
        example: '10001',
    })
    @IsNotEmpty()
    @IsString()
    postalCode: string;
}

export class GSTDetails {
    @ApiPropertyOptional({
        description: 'GST company address',
        example: '123 Main Street',
    })
    @IsOptional()
    @IsString()
    gstCompanyAddress?: string;

    @ApiPropertyOptional({
        description: 'GST company contact number',
        example: '1234567890',
    })
    @IsOptional()
    @IsString()
    gstCompanyContactNumber?: string;

    @ApiPropertyOptional({
        description: 'GST company name',
        example: 'ABC Company Ltd.',
    })
    @IsOptional()
    @IsString()
    gstCompanyName?: string;

    @ApiPropertyOptional({
        description: 'GST number',
        example: '27AAAAA0000A1Z5',
    })
    @IsOptional()
    @IsString()
    gstNumber?: string;

    @ApiPropertyOptional({
        description: 'GST company email',
        example: 'company@example.com',
        format: 'email',
    })
    @IsOptional()
    @IsEmail()
    gstCompanyEmail?: string;
}

export class BookDto {
    @ApiProperty({
        description: 'Solution ID for booking',
        example: '7e3294817ad26fe6a885ca3b57312dbd',
    })
    @IsNotEmpty()
    @IsString()
    solutionId: string;

    @ApiProperty({
        description: 'Search request ID',
        example: 'efc080e1-3989-427d-abd4-edc7c04d27ab',
        format: 'uuid',
    })
    @IsNotEmpty()
    @IsString()
    searchReqId: string;

    @ApiProperty({
        description: 'Tracking ID',
        example: 'bdd3ff73-5ee7-49fc-bafa-34ba0666bfb7',
    })
    @IsNotEmpty()
    @IsString()
    trackingId: string;

    @ApiProperty({
        description: 'Provider code',
        example: 'PK',
    })
    @IsNotEmpty()
    @IsString()
    providerCode: string;

    @ApiProperty({
        description: 'Fare type',
        example: 'PUBLIC',
        enum: ['PUBLIC', 'PRIVATE', 'CORPORATE'],
    })
    @IsString()
    fareType: string;

    @ApiProperty({
        description: 'airTripType needed here.',
        example: 'oneway',
    })
    @IsNotEmpty()
    airTripType: string;

    @ApiProperty({
        description: 'airlineType received in search result, could be LCC, Non-LCC GDS etc.',
        example: 'LCC',
    })
    @IsNotEmpty()
    airlineType: string;

    @ApiProperty({
        description: 'Passenger information',
        type: [Passenger],
        example: [
            {
                passengerType: 'ADT',
                gender: 'M',
                passengerDetail: {
                    title: 'Mr',
                    firstName: 'John',
                    lastName: 'Doe',
                },
                dateOfBirth: '1990-01-15',
                document: {
                    documentType: 'P',
                    documentNumber: 'A1234567',
                    expiryDate: '2030-12-31',
                    country: 'US',
                },
                nationality: 'US',
                mobile: '1234567890',
                mobileCountryCode: '+1',
            },
            {
                passengerType: 'ADT',
                gender: 'F',
                passengerDetail: {
                    title: 'Ms',
                    firstName: 'Jane',
                    lastName: 'Doe',
                },
                dateOfBirth: '1992-03-20',
                document: {
                    documentType: 'P',
                    documentNumber: 'B7654321',
                    expiryDate: '2030-12-31',
                    country: 'US',
                },
                nationality: 'US',
                mobile: '1234567891',
                mobileCountryCode: '+1',
            },
        ],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Passenger)
    passengers: Passenger[];

    @ApiProperty({
        description: 'Contact information',
        type: ContactInfo,
        example: {
            title: 'Mr',
            firstName: 'John',
            lastName: 'Doe',
            gender: 'M',
            email: 'john.doe@example.com',
            mobile: '1234567890',
            mobileCountryCode: '+1',
            postalCode: '10001',
        },
    })
    @ValidateNested()
    @Type(() => ContactInfo)
    contact: ContactInfo;

    @ApiProperty({
        description: 'Route information - array of flight segments for each leg of the journey',
        type: [RouteDetails],
        isArray: true,
        example: [
            [
                {
                    airline: 'AA',
                    departureCode: 'LGA',
                    departureDate: '2026-01-15',
                    departureTime: '09:29 AM',
                    arrivalCode: 'ORD',
                    arrivalDate: '2026-01-15',
                    arrivalTime: '11:10 AM',
                    bookingCode: 'Q',
                    flightNum: '3234',
                },
                {
                    airline: 'AA',
                    departureCode: 'ORD',
                    departureDate: '2026-01-15',
                    departureTime: '02:14 PM',
                    arrivalCode: 'LAX',
                    arrivalDate: '2026-01-15',
                    arrivalTime: '04:52 PM',
                    bookingCode: 'Q',
                    flightNum: '1204',
                },
            ],
        ],
    })
    @IsArray({ each: true })
    @ValidateNested({ each: true })
    @Type(() => RouteDetails)
    routes: RouteDetails[][];

    @ApiPropertyOptional({
        description: 'GST details (optional - may be required based on flight/supplier)',
        type: GSTDetails,
        example: {
            gstCompanyAddress: '123 Main Street',
            gstCompanyContactNumber: '1234567890',
            gstCompanyName: 'ABC Company Ltd.',
            gstNumber: '27AAAAA0000A1Z5',
            gstCompanyEmail: 'company@example.com',
        },
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => GSTDetails)
    gst?: GSTDetails;
}

export class BookConfirmationDto {
    @ApiProperty({
        description: 'Booking ID',
        example: '1234567890',
    })
    @IsNotEmpty()
    @IsString()
    bookingId: string;

    @ApiProperty({
        description: 'Booking log ID',
        example: '1234567890',
    })
    @IsNotEmpty()
    @IsString()
    bookingLogId: string;
}
