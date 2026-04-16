import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class HotelBookConfirmationDto {
    @ApiProperty({
        description: 'Reference booking ID',
        example: 'TA-2343246',
    })
    @IsNotEmpty()
    @IsString()
    bookingRefId: string;

    @ApiProperty({
        description: 'Search Request ID',
        example: '1234567890',
    })
    @IsNotEmpty()
    @IsString()
    searchReqId: string;

    @ApiProperty({
        description: 'Payment log ID',
        example: 'test-1234567890',
    })
    @IsNotEmpty()
    @IsString()
    paymentLogId: string;
}