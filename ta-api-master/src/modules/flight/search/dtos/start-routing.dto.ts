import { IsArray, IsNotEmpty, ValidateNested, IsDateString, IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchAirLegs {
    @ApiProperty({
        description: 'Departure date for the flight',
        example: '2025-06-15',
        format: 'date',
    })
    @IsNotEmpty()
    @IsDateString()
    departureDate: string;

    @ApiProperty({
        description: 'Origin airport code',
        example: 'NYC',
    })
    @IsNotEmpty()
    @IsString()
    origin: string;

    @ApiProperty({
        description: 'Destination airport code',
        example: 'LAX',
    })
    @IsNotEmpty()
    @IsString()
    destination: string;
}

export class TravelPreference {
    @ApiProperty({
        description: 'Maximum number of stops allowed',
        example: 2,
        minimum: 0,
    })
    @IsNumber()
    maxStopsQuantity: number;

    @ApiProperty({
        description: 'Cabin class preference',
        example: 'Economy',
        enum: ['Economy', 'Business', 'First', 'All'],
    })
    @IsString()
    cabinClass: string;

    @ApiProperty({
        description: 'Type of air trip',
        example: 'oneway',
        enum: ['oneway', 'roundtrip', 'multi-city'],
    })
    @IsNotEmpty()
    @IsString()
    airTripType: string;

    @ApiPropertyOptional({
        description: 'Whether to include nearby airports',
        example: false,
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    nearByAirports?: boolean;
}

export class Paxes {
    @ApiProperty({
        description: 'Type of passenger',
        example: 'ADT',
        enum: ['ADT', 'CHD', 'INF'],
    })
    @IsNotEmpty()
    @IsString()
    type: string;

    @ApiProperty({
        description: 'Number of passengers of this type',
        example: 2,
        minimum: 1,
    })
    @IsNotEmpty()
    @IsNumber()
    quantity: number;
}

export class StartRoutingDto {
    @ApiProperty({
        description: 'Array of search air legs',
        type: [SearchAirLegs],
        example: [
            {
                departureDate: '2026-06-15',
                origin: 'NYC',
                destination: 'LAX',
            },
            {
                departureDate: '2026-06-20',
                origin: 'LAX',
                destination: 'NYC',
            },
        ],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SearchAirLegs)
    searchAirLegs: SearchAirLegs[];

    @ApiProperty({
        description: 'Array of travel preferences',
        type: [TravelPreference],
        example: [
            {
                maxStopsQuantity: 2,
                cabinClass: 'Economy',
                airTripType: 'roundtrip',
                nearByAirports: false,
            },
        ],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TravelPreference)
    travelPreferences: TravelPreference[];

    @ApiProperty({
        description: 'Array of passenger information',
        type: [Paxes],
        example: [
            {
                type: 'ADT',
                quantity: 2,
            },
        ],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Paxes)
    paxes: Paxes[];
}
