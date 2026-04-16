import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BalanceCheckDto {
    @ApiProperty({
        description: 'Provider mode',
        example: 'Production',
        enum: ['Production', 'Test', 'Sandbox'],
    })
    @IsNotEmpty()
    @IsString()
    mode: string;

    @ApiProperty({
        description: 'Provider code',
        example: 'PK',
    })
    @IsNotEmpty()
    @IsString()
    providerCode: string;
}
