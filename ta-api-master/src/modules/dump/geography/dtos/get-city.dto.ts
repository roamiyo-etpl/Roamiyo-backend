import { IsNotEmpty, IsString, Matches, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class GetCityDto {
    @ApiProperty({
        description: 'State Code',
        example: 'BDS',
    })
    @IsNotEmpty({ message: 'State code is required' })
    @IsString()
    @Matches(/^[A-Za-z\d-]{1,5}$/, { message: 'State code must be a valid state code' })
    stateCode: string;

    @ApiProperty({
        description: 'Country Code',
        example: 'IN, US, etc.',
    })
    @IsNotEmpty({ message: 'Country code is required' })
    @IsString()
    @Matches(/^[A-Z]{2}$/, { message: 'Country code must be a valid country code' })
    countryCode: string;

    @ApiPropertyOptional({
        description: 'City Name',
        example: 'Mumbai',
    })
    @IsOptional()
    @Transform(({ value }: { value: string }) => value?.trim())
    @IsString()
    @IsNotEmpty({ message: 'City name is required' })
    @MinLength(3, { message: 'City name must be at least 3 characters long' })
    @MaxLength(50, { message: 'City name must be at most 50 characters long' })
    cityName?: string;
}
