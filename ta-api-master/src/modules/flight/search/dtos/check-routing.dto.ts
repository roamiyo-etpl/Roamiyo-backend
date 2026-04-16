import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckRoutingDto {
    @ApiProperty({
        description: 'Search request ID to check routing status',
        example: '123e4567-e89b-12d3-a456-426614174000',
        format: 'uuid',
    })
    @IsNotEmpty()
    @IsString()
    searchReqId: string;
}
