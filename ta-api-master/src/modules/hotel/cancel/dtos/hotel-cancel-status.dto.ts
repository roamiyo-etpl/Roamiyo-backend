import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { CancelMode } from 'src/modules/cancel/dto/cancel.dto';

export class HotelCancelStatusDto {
    @ApiProperty({ description: 'Cancellation mode', enum: CancelMode, example: CancelMode.Hotel })
    @IsEnum(CancelMode)
    mode: CancelMode;

    @ApiProperty({ description: 'Internal booking UUID', example: 'cf1b7a0f-3fba-45ad-929d-d51bf8c262ce' })
    @IsString()
    @IsNotEmpty()
    booking_id: string;

    @ApiProperty({ description: 'TBO supplier booking id', example: 2139857 })
    @IsNumber()
    @IsNotEmpty()
    bookingId: number;

    @ApiProperty({
        description: 'TBO ChangeRequestId from POST /cancel response',
        example: 404404,
    })
    @IsNumber()
    @IsNotEmpty()
    changeRequestId: number;

    @ApiProperty({
        description: 'Existing cancellations row UUID (optional — speeds up DB update)',
        required: false,
    })
    @IsString()
    @IsOptional()
    cancellationId?: string;
}
