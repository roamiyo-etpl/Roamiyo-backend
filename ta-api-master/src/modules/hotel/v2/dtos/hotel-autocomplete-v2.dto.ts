import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class HotelAutocompleteV2Dto {
    @ApiProperty({ description: 'Text typed by the user (city or hotel name)', example: 'leela palace' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty()
    @MinLength(3, { message: 'query must be at least 3 characters long' })
    @MaxLength(100, { message: 'query must be at most 100 characters long' })
    query: string;

    @ApiPropertyOptional({ description: 'Only return cities / hotels of this country (ISO 2 letter)', example: 'IN' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
    @IsOptional()
    @IsString()
    @Length(2, 2)
    countryCode?: string;

    @ApiPropertyOptional({ description: 'Booking market (ISO 2 letter). Cities / hotels of this country are shown first, others are still returned', example: 'IN' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
    @IsOptional()
    @IsString()
    @Length(2, 2)
    market?: string;
}
