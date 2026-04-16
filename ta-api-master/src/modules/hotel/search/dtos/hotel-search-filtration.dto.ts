import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsNotEmpty, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { ApiEnvironment } from 'src/shared/enums/hotel/hotel.enum';
import { SortDto } from './hotel-search-initiate.dto';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PaginationDto {
    @ApiProperty({
        description: 'Page',
        example: 1,
    })
    @IsNotEmpty()
    @IsInt()
    @Min(1)
    page: number;

    @ApiProperty({
        description: 'Limit ,Total Number of records per page',
        example: 20,
    })
    @IsNotEmpty()
    @IsInt()
    @Min(1)
    limit: number;
}

export class FiltersDto {
    @ApiProperty({
        description: 'Price range Min and Max (can be array of numbers or array of bucket labels)',
        example: [50, 200],
        required: false,
    })
    @IsArray()
    priceRange?: [number, number] | string[];

    @ApiProperty({
        description: 'Array of star rating',
        example: [2, 4, 5],
    })
    @IsNotEmpty()
    @IsArray()
    @IsInt({ each: true })
    starRating: number[];

    @ApiProperty({
        description: 'Array of amenities',
        example: ['Parking', 'Free WiFi'],
    })
    @IsNotEmpty()
    @IsArray()
    @IsString({ each: true })
    amenities: string[];

    @ApiProperty({
        description: 'Meal Type Array of string',
        example: ['Room_Only', 'BreakFast'],
    })
    @IsNotEmpty()
    @IsArray()
    @IsString({ each: true })
    mealTypes: string[];

    @ApiProperty({
        description: 'Nearborhood location',
        example: ['Kalkaji Mandir', 'Indira Gandhi International Airport (DEL)'],
    })
    @IsNotEmpty()
    @IsArray()
    @IsString({ each: true })
    neighborhoods: string[];

    @ApiProperty({
        description: 'Point of interest',
        example: ['Kalkaji Mandir', 'Indira Gandhi International Airport (DEL)'],
    })
    @IsNotEmpty()
    @IsArray()
    @IsString({ each: true })
    poi: string[];

    @ApiProperty({
        description: 'Cancellation policy',
        example: ['refundable', 'non-refundable'],
    })
    @IsNotEmpty()
    @IsArray()
    @IsString({ each: true })
    cancellation: string[];

    @ApiProperty({
        description: 'Hotel Name',
        example: '["The Suryaa New Delhi", "Moustache Delhi"]',
    })
    @IsNotEmpty()
    @IsArray()
    @IsString({ each: true })
    hotelNames: string[];
}

export class HotelSearchFiltrationDto {
    @ApiProperty({
        description: 'This will be the UUID that we receive from the search/initiate',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsNotEmpty()
    @IsUUID()
    searchReqId: string;

    @ApiProperty({
        description: 'Environment name',
        example: 'test',
    })
    @IsNotEmpty()
    @IsEnum(ApiEnvironment)
    apiEnvironment: ApiEnvironment;

    @ApiProperty({ type: SortDto })
    @ValidateNested()
    @Type(() => SortDto)
    @IsNotEmpty()
    sort: SortDto;

    @ApiProperty({ type: PaginationDto })
    @ValidateNested()
    @Type(() => PaginationDto)
    pagination: PaginationDto;

    @ApiProperty({ type: FiltersDto })
    @ValidateNested()
    @Type(() => FiltersDto)
    filters: FiltersDto;
}
