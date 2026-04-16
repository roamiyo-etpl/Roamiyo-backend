import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class TransferDataToHotelContent {
    @ApiProperty({
        description: 'Start Number',
        example: 0,
        minimum: 0,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    from: number;

    @ApiProperty({
        description: 'End Number',
        example: 1000,
        minimum: 0,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    to: number;
}
