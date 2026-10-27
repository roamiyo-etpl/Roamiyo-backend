import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';
import { RadiusUnit } from 'src/shared/enums/hotel/hotel.enum';
import { GeoLocationDto, RoomDto, SearchMetaDataDto, SearchSettingDto, SortDto } from '../../search/dtos/hotel-search-initiate.dto';

/**
 * v2 location: geoLocation is needed for a city search only. A hotel search sends HotelCodes instead.
 */
export class LocationV2Dto {
    @ApiPropertyOptional({ type: GeoLocationDto, description: 'Required for city search: geoLocation of the selected city suggestion' })
    @IsOptional()
    @ValidateNested()
    @Type(() => GeoLocationDto)
    geoLocation?: GeoLocationDto;

    @ApiPropertyOptional({ description: 'Text of the selected suggestion', example: 'New Delhi' })
    @IsOptional()
    @IsString()
    searchKeyword?: string;

    @ApiProperty({ description: 'Country Code of the selected suggestion', example: 'IN' })
    @IsNotEmpty()
    @IsString()
    country: string;

    @ApiPropertyOptional({ description: 'City of the selected suggestion', example: 'New Delhi' })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiPropertyOptional({ description: 'Area of the selected suggestion', example: 'New Delhi' })
    @IsOptional()
    @IsString()
    area?: string;

    @ApiPropertyOptional({ description: 'Radius in km (city search)', example: 10 })
    @IsOptional()
    @IsPositive()
    radius?: number;

    @ApiPropertyOptional({ description: 'Radius unit', example: 'km' })
    @IsOptional()
    @IsEnum(RadiusUnit)
    radiusUnit?: RadiusUnit;

    @ApiPropertyOptional({ description: 'Hotel ID', example: 1863197 })
    @IsOptional()
    @IsInt()
    hotelId?: number;
}

export class SearchCriteriaV2Dto {
    @ApiProperty({ description: 'Check In Date', example: '2026-11-08' })
    @IsNotEmpty()
    @IsDateString()
    checkIn: string;

    @ApiProperty({ description: 'Check Out Date', example: '2026-11-09' })
    @IsNotEmpty()
    @IsDateString()
    checkOut: string;

    @ApiProperty({ type: [RoomDto], example: [{ adults: 2, children: 0, childAges: [] }] })
    @ValidateNested()
    @Type(() => RoomDto)
    rooms: RoomDto | RoomDto[];

    @ApiProperty({ type: LocationV2Dto })
    @ValidateNested()
    @Type(() => LocationV2Dto)
    location: LocationV2Dto;

    @ApiPropertyOptional({
        description: 'Hotel search: hotelCode of the selected hotel suggestion (comma separated for more than one). When sent, geoLocation is ignored',
        example: '1357541',
    })
    @IsOptional()
    @IsString()
    HotelCodes?: string;
}

export class HotelSearchInitiateV2Dto {
    @ApiProperty({ type: SearchCriteriaV2Dto })
    @ValidateNested()
    @Type(() => SearchCriteriaV2Dto)
    @IsNotEmpty()
    searchCriteria: SearchCriteriaV2Dto;

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

    @ApiPropertyOptional({ description: 'Same as v1: seconds the client waits before an inProgress response', example: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsPositive()
    ResponseTime?: number;
}
