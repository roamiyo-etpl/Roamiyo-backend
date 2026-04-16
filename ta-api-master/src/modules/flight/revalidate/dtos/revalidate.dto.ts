import { IsArray, IsNotEmpty, ValidateNested, IsDateString, IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
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
        example: '2026-06-15',
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
        example: '2026-06-15',
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
        description: 'Flight number',
        example: '3234',
    })
    @IsNotEmpty()
    @IsString()
    flightNum: string;

    @ApiProperty({
        description: 'Booking class code',
        example: 'Q',
    })
    @IsString()
    bookingCode: string;
}

// Routes class removed - routes is now directly RouteDetails[][]

export class PaxesInfo {
    @ApiProperty({
        description: 'Number of adult passengers',
        example: 2,
        minimum: 1,
    })
    @IsNotEmpty()
    @IsNumber()
    adult: number;

    @ApiProperty({
        description: 'Number of child passengers',
        example: 1,
        minimum: 0,
    })
    @IsNumber()
    children: number;

    @ApiProperty({
        description: 'Number of infant passengers',
        example: 0,
        minimum: 0,
    })
    @IsNumber()
    infant: number;
}

export class GroupHash {
    @ApiProperty({
        description: 'Provider code',
        example: 'PK',
    })
    @IsString()
    provider: string;

    @ApiProperty({
        description: 'Net amount for this group',
        example: 450.0,
    })
    @IsNumber()
    netAmount: number;

    @ApiProperty({
        description: 'Solution ID',
        example: 'SOL123456',
    })
    @IsString()
    solutionId: string;
}

export class RevalidateDto {
    @ApiProperty({
        description: 'Solution ID to revalidate',
        example:
            'r5TawedGI+0dM3carFbMJrd0HGyLKfhDxLXg4GJedq2AV9JFLKQegvdbLSnClFO2Mkx7b5JAgrZdSWMarjX8lKqrnAqDCV5a3yMWYjrHknjx5zPImWcAfD9DI81sDgJjMTuz1HJ1yvECFaWGfmsXHlX4+D4kOpqO4H4yB8c2ZFKa/7JlNub+07SJ44LWbWqYeuf0k3Qz7od788m53mnZtynA4x3fcDOVMYrmn7QlH6fVwEW0HZM+htwivXaVQSoRYAP0yLTjH3DaCifTS4ZTvCSw8mmeMBN2DKEYlMwaKNRAdvuIe3x/lSMX4CYWOMRkaDNbsm5eFPiLphWK10SQUqBK+AIX8C6PfKifMNutFKaw/bmDid1/Sgxz+jTYDvFCnKg/aQpnz8vUXoCQVSynQw==',
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
        description: 'trackingId received in search result.',
        example: 'bdd3ff73-5ee7-49fc-bafa-34ba0666bfb7',
    })
    @IsOptional()
    trackingId: string;

    @ApiProperty({
        description: 'Provider code',
        example: 'PK',
    })
    @IsNotEmpty()
    @IsString()
    providerCode: string;

    @ApiProperty({
        description: 'Type of air trip',
        example: 'OneWay',
        enum: ['OneWay', 'RoundTrip', 'MultiCity'],
    })
    @IsNotEmpty()
    @IsString()
    airTripType: string;

    @ApiProperty({
        description: 'Cabin class',
        example: 'Economy',
        enum: ['Economy', 'Business', 'First'],
    })
    @IsNotEmpty()
    @IsString()
    cabinClass: string;

    @ApiPropertyOptional({
        description: 'Whether this is a multi-revalidation request',
        example: false,
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    isMultiReValid?: boolean;

    @ApiPropertyOptional({
        description: 'Group hash information',
        type: [GroupHash],
        example: [
            {
                provider: 'PK',
                netAmount: 370.7,
                solutionId:
                    'r5TawedGI+0dM3carFbMJrd0HGyLKfhDxLXg4GJedq2AV9JFLKQegvdbLSnClFO2Mkx7b5JAgrZdSWMarjX8lKqrnAqDCV5a3yMWYjrHknjx5zPImWcAfD9DI81sDgJjMTuz1HJ1yvECFaWGfmsXHlX4+D4kOpqO4H4yB8c2ZFKa/7JlNub+07SJ44LWbWqYeuf0k3Qz7od788m53mnZtynA4x3fcDOVMYrmn7QlH6fVwEW0HZM+htwivXaVQSoRYAP0yLTjH3DaCifTS4ZTvCSw8mmeMBN2DKEYlMwaKNRAdvuIe3x/lSMX4CYWOMRkaDNbsm5eFPiLphWK10SQUqBK+AIX8C6PfKifMNutFKaw/bmDid1/Sgxz+jTYDvFCnKg/aQpnz8vUXoCQVSynQw==',
            },
        ],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GroupHash)
    groupHash?: GroupHash[];

    @ApiProperty({
        description: 'Passenger information',
        type: [PaxesInfo],
        example: [
            {
                adult: 2,
                children: 0,
                infant: 0,
            },
        ],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PaxesInfo)
    paxes: PaxesInfo[];

    @ApiProperty({
        description: 'Route information - array of flight segments for each leg of the journey',
        type: [RouteDetails],
        isArray: true,
        example: [
            [
                {
                    airline: 'AA',
                    departureCode: 'LGA',
                    departureDate: '2026-06-15',
                    departureTime: '09:29 AM',
                    arrivalCode: 'ORD',
                    arrivalDate: '2026-06-15',
                    arrivalTime: '11:10 AM',
                    flightNum: '3234',
                    bookingCode: 'Q',
                },
                {
                    airline: 'AA',
                    departureCode: 'ORD',
                    departureDate: '2026-06-15',
                    departureTime: '02:14 PM',
                    arrivalCode: 'LAX',
                    arrivalDate: '2026-06-15',
                    arrivalTime: '04:52 PM',
                    flightNum: '1204',
                    bookingCode: 'Q',
                },
            ],
        ],
    })
    @IsArray({ each: true })
    @ValidateNested({ each: true })
    @Type(() => RouteDetails)
    routes: RouteDetails[][];
}
