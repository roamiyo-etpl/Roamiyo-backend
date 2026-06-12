import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BookReconcileDto {
    @ApiProperty({ description: 'Booking ID from initiate response' })
    @IsNotEmpty()
    @IsString()
    bookingId: string;

    @ApiProperty({ description: 'Booking log ID from initiate response' })
    @IsNotEmpty()
    @IsString()
    bookingLogId: string;
}
