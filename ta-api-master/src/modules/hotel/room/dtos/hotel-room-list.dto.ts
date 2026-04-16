import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDateString, IsNumber, IsOptional, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RoomDto, SearchMetaDataDto } from '../../search/dtos/hotel-search-initiate.dto';

export class HotelRoomListRequestDto {
    @ApiProperty({
        description: 'Hotel ID',
        example: '1863197',
    })
    @IsNotEmpty()
    @IsString()
    hotelId: string;

    @ApiProperty({
        description: 'searchReqId received in search result.',
        example: '93e44d92-8236-48c3-acd8-04d43f477a02',
    })
    @IsNotEmpty()
    searchReqId!: string;

    @ApiProperty({
        description: 'Supplier code',
        example: 'TBO',
    })
    @IsNotEmpty()
    @IsString()
    supplierCode: string;

    @ApiProperty({
        description: 'Check-in date (YYYY-MM-DD)',
        example: '2026-05-15',
    })
    @IsNotEmpty()
    @IsDateString()
    checkIn: string;

    @ApiProperty({
        description: 'Check-out date (YYYY-MM-DD)',
        example: '2026-05-16',
    })
    @IsNotEmpty()
    @IsDateString()
    checkOut: string;

    @ApiProperty({
        description: 'Room configuration { adults: 2, children: 1, childAges: [8] },',
        type: [RoomDto],
        example: [

            { adults: 1, children: 0, childAges: [] }
        ],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RoomDto)
    rooms: RoomDto[];

    @ApiProperty({ type: SearchMetaDataDto })
    @ValidateNested()
    @Type(() => SearchMetaDataDto)
    @IsNotEmpty()
    searchMetadata: SearchMetaDataDto;
}
