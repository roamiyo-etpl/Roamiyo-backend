import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetCountryDto {
    @ApiPropertyOptional({
        description: 'Country Name',
        example: 'India',
    })
    @IsOptional()
    @Transform(({ value }: { value: string }) => value?.trim())
    @IsString()
    @IsNotEmpty({ message: 'Country name is required' })
    @MinLength(3, { message: 'Country name must be at least 3 characters long' })
    @MaxLength(50, { message: 'Country name must be at most 50 characters long' })
    countryName?: string;
}
