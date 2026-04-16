import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsLatitude, IsLongitude, IsNumber, MinLength, MaxLength } from 'class-validator';
import { BadRequestException } from '@nestjs/common';

export class HotelAutocompleteDto {
    @ApiProperty({
        description: 'Search Query',
        example: 'Cairo, Egypt, India, Mumbai, etc.',
    })
    @Transform(({ value }: { value: string }) => value.trim())
    @MinLength(3, { message: 'Query must be at least 3 characters long' })
    @MaxLength(255, { message: 'Query must be at most 255 characters long' })
    @IsString()
    @IsNotEmpty()
    query: string;

    @ApiPropertyOptional({
        description: 'User Latitude',
        example: '19.076',
    })
    @Transform(({ value }) => {
        const val = parseFloat(value as string);
        if (isNaN(val)) {
            throw new BadRequestException('Latitude must be a between -90 and 90');
        }
        return val;
    })
    @IsOptional()
    @IsNumber()
    @IsLatitude({ message: 'Latitude must be between -90 and 90' })
    lat?: number;

    @ApiPropertyOptional({
        description: 'User Longitude',
        example: '72.8777',
    })
    @Transform(({ value }) => {
        const val = parseFloat(value as string);
        if (isNaN(val)) {
            throw new BadRequestException('Longitude must be a between -180 and 180');
        }
        return val;
    })
    @IsOptional()
    @IsNumber()
    @IsLongitude({ message: 'Longitude must be between -180 and 180' })
    long?: number;
}
