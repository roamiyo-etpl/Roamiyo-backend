import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength, MaxLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetStateDto {
    @ApiProperty({
        description: 'Country Code',
        example: 'IN, US, etc.',
    })
    @IsNotEmpty({ message: 'Country code is required' })
    @IsString()
    @Matches(/^[A-Z]{2}$/, { message: 'Country code must be a valid country code' })
    countryCode: string;

    @ApiPropertyOptional({
        description: 'State Name',
        example: 'Maharashtra',
    })
    @IsOptional()
    @Transform(({ value }: { value: string }) => value?.trim())
    @IsString()
    @IsNotEmpty({ message: 'State name is required' })
    @MinLength(3, { message: 'State name must be at least 3 characters long' })
    @MaxLength(50, { message: 'State name must be at most 50 characters long' })
    stateName?: string;
}
