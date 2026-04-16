import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Min, ValidateIf, ValidateNested } from 'class-validator';
import { ApiEnvironment, Channel, HotelSearchBy, HotelSearchType, RadiusUnit, SortOrder } from 'src/shared/enums/hotel/hotel.enum';

export class RoomDto {
    @ApiProperty({
        description: 'Number of adults',
        example: 1,
    })
    @IsNotEmpty()
    @IsInt()
    @Min(1)
    adults: number;

    @ApiProperty({
        description: 'Number of children',
        example: 1,
    })
    @IsNotEmpty()
    @IsInt()
    @Min(0)
    children: number;

    @ValidateIf((o) => o.children > 0)
    @IsNotEmpty()
    @ApiProperty({
        description: 'children age as Array of number',
        example: [2, 4],
    })
    childAges: number[];
}
export class GeoLocationDto {
    @ApiProperty({
        description: 'Latitude of location',
        example: 28.560985,
    })
    @IsNotEmpty()
    latitude: number;

    @ApiProperty({
        description: 'Longitude of location',
        example: 77.269694,
    })
    @IsNotEmpty()
    longitude: number;
}

export class LocationDto {
    @ApiProperty({ type: GeoLocationDto })
    @IsNotEmpty()
    @ValidateNested()
    @Type(() => GeoLocationDto)
    geoLocation: GeoLocationDto;

    @ApiPropertyOptional({
        description: 'Google Place Id',
        example: 'q3s5s82s5353',
    })
    @IsString()
    @IsOptional()
    placeId?: string | null;

    @ApiProperty({
        description: 'Search Keyword',
        example: 'MG Road, Bangalore',
    })
    @IsNotEmpty()
    @IsString()
    searchKeyword: string;

    @ApiProperty({
        description: 'Country Code',
        example: 'IN',
    })
    @IsNotEmpty()
    @IsString()
    country: string; // You may add length=2 validation for ISO country code

    @ApiProperty({
        description: 'Enter City',
        example: 'Delhi',
    })
    @IsNotEmpty()
    @IsString()
    city: string;

    @ApiProperty({
        description: 'Radius in km or mil',
        example: 5,
    })
    @IsNotEmpty()
    @IsPositive()
    radius: number;

    @ApiProperty({
        description: 'Radius unit',
        example: 'km',
    })
    @IsNotEmpty()
    @IsEnum(RadiusUnit)
    radiusUnit: RadiusUnit;

    @ApiPropertyOptional({
        description: 'Hotel ID',
        example: 1863197,
    })
    @IsInt()
    @IsOptional()
    hotelId: number;
}

export class SearchCriteriaDto {
    @ApiProperty({
        description: 'Check In Date',
        example: '2026-05-15',
    })
    @IsNotEmpty()
    @IsDateString()
    checkIn: string;

    @ApiProperty({
        description: 'Check Out Date',
        example: '2026-05-16',
    })
    @IsNotEmpty()
    @IsDateString()
    checkOut: string;

    @ApiProperty({
        type: [RoomDto],
        description: 'Room details - can be a single room object or array of rooms adults: 1, children: 1, childAges: [2, 4]',
        example: [{ adults: 1, children: 0, childAges: [] }],
    })
    @ValidateNested()
    @Type(() => RoomDto)
    rooms: RoomDto | RoomDto[];

    @ApiProperty({ type: LocationDto })
    @ValidateNested()
    @Type(() => LocationDto)
    location: LocationDto;
}
export class SearchMetaDataDto {
    @ApiProperty({
        description: 'Enter Guest Nationality',
        example: 'IN',
    })
    @IsString()
    @IsNotEmpty()
    guestNationality: string; // ISO 2-letter or 3-letter code

    @ApiProperty({
        description: 'Enter Search Type',
        example: 'hotel',
    })
    @IsNotEmpty()
    @IsEnum(HotelSearchType)
    searchType: HotelSearchType;

    @ApiProperty({
        description: 'Booking Market',
        example: 'IN',
    })
    @IsNotEmpty()
    @IsString()
    market: string;

    @ApiProperty({
        description: 'Enter channel name',
        example: 'web',
    })
    @IsNotEmpty()
    @IsEnum(Channel)
    channel: Channel = Channel.WEB;
}

export class SearchSettingDto {
    @ApiProperty({
        description: 'Environment Name',
        example: 'test',
    })
    @IsNotEmpty()
    @IsEnum(ApiEnvironment)
    apiEnvironment: ApiEnvironment;

    @ApiProperty({
        description: 'check is refundable true or false',
        example: false,
    })
    @IsBoolean()
    refundableOnly?: boolean;

    @ApiProperty({
        description: 'Pagelimit Number of records required per page.',
        example: 10,
    })
    @IsNotEmpty()
    @IsInt()
    pageLimit: number;
}
export class SortDto {
    @ApiProperty({
        description: 'Hotel Search By',
        example: 'price',
        enum: HotelSearchBy,
    })
    @IsNotEmpty()
    @IsEnum(HotelSearchBy)
    by: HotelSearchBy;

    @ApiProperty({
        description: 'Hotel Sorted By',
        example: 'asc',
        enum: SortOrder,
    })
    @IsNotEmpty()
    @IsEnum(SortOrder)
    order: SortOrder = SortOrder.ASC; // default ASC enum "asc" | "desc"
}

export class HotelSearchInitiateDto {
    @ApiProperty({ type: SearchCriteriaDto })
    @ValidateNested()
    @Type(() => SearchCriteriaDto)
    @IsNotEmpty()
    searchCriteria: SearchCriteriaDto;

    @ApiProperty({ type: SearchMetaDataDto })
    @ValidateNested()
    @Type(() => SearchMetaDataDto)
    @IsNotEmpty()
    searchMetadata: SearchMetaDataDto;

    @ApiProperty({ type: SearchSettingDto })
    @ValidateNested()
    @Type(() => SearchSettingDto)
    @IsNotEmpty()
    searchSetting: SearchSettingDto;

    @ApiProperty({ type: SortDto })
    @ValidateNested()
    @Type(() => SortDto)
    @IsNotEmpty()
    sort: SortDto;
}
