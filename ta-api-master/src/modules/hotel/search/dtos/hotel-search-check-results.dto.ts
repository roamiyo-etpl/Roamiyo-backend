import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { SearchSettingDto, SortDto } from './hotel-search-initiate.dto';
import { Type } from 'class-transformer';

export class HotelSearchCheckResultsDto {
    @ApiProperty({
        description: 'This will be the UUID that we receive from the search/initiate',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsNotEmpty()
    @IsString()
    searchReqId: string;

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
