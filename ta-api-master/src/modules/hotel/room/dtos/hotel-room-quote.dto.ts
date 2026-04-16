import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';

// Define the structure of roomBookingInfo
export class RoomBookingInfoDto {
    @ApiProperty({
        description: 'unique identifier for the rate, used for booking.',
        example: '1863197!TB!1!TB!496ded91-ba3c-11f0-8195-4a620032403f!TB!N!TB!AFF!',
    })
    @IsNotEmpty()
    rateKey!: string;

    @ApiPropertyOptional({
        description: 'number of rooms.',
        example: 1,
    })
    @IsOptional()
    rooms?: number;

    @ApiPropertyOptional({
        description: 'number of adults.',
        example: 1,
    })
    @IsOptional()
    adults?: number;

    @ApiPropertyOptional({
        description: 'number of children.',
        example: 1,
    })
    @IsOptional()
    children?: number;

    @ApiPropertyOptional({
        description: 'ages of children as an array of numbers.',
        example: [3],
    })
    @IsOptional()
    childAges?: number[];
}

export class HotelRoomQuoteDto {
    @IsOptional()
    @ApiPropertyOptional({
        description: 'hotelId received in search result.',
        example: '1863197',
    })
    hotelId?: string;

    // @ApiProperty({
    //     description: 'uniqueId/rateKey received in search result.',
    //     example: '6E823|AMD-BLR|2024-02-13',
    // })
    // @IsNotEmpty()
    // rateKey!: string;

    @ApiProperty({
        description: 'searchReqId received in room list.',
        example: '93e44d92-8236-48c3-acd8-04d43f477a02',
    })
    @IsNotEmpty()
    searchReqId!: string;

    @ApiProperty({
        description: 'providerCode for which this quote needs to be checked.',
        example: 'TBO',
    })
    @IsNotEmpty()
    supplierCode!: string;

    @ApiProperty({
        description: 'Room booking information.',
        type: [RoomBookingInfoDto],
    })
    @IsNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => RoomBookingInfoDto)
    roomBookingInfo!: RoomBookingInfoDto[];
}
