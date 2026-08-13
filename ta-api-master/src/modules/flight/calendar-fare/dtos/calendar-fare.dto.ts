import { IsArray, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CalendarFareDto {
    @ApiProperty({
        description: 'Origin city code',
        example: 'DEL',
    })
    @IsNotEmpty()
    @IsString()
    origin: string;

    @ApiProperty({
        description: 'Destination city code',
        example: 'BOM',
    })
    @IsNotEmpty()
    @IsString()
    destination: string;

    @ApiProperty({
        description: 'Cabin class preference',
        example: 'Economy',
        enum: ['Economy', 'Business', 'First', 'All', 'Premium_Economy'],
    })
    @IsNotEmpty()
    @IsString()
    cabinClass: string;

    @ApiProperty({
        description: 'Preferred departure date - any date within the target month, GetCalendarFare returns the whole month',
        example: '2026-08-01',
        format: 'date',
    })
    @IsNotEmpty()
    @IsDateString()
    preferredDepartureDate: string;

    @ApiPropertyOptional({
        description: 'Preferred airlines filter - works only on GDS airline',
        example: ['AI', '9W', 'SG'],
        type: [String],
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    preferredAirlines?: string[];

    @ApiPropertyOptional({
        description: 'Airline sources filter',
        example: ['GDS', '6E', 'SG', 'G8'],
        type: [String],
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    sources?: string[];
}
