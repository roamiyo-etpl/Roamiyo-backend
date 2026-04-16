import { IsNotEmpty, IsNumber } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ContentDumpRequestDto {
    @ApiProperty({
        description: 'From',
        example: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    from: number;

    @ApiProperty({
        description: 'To',
        example: 1000,
    })
    @IsNumber()
    @IsNotEmpty()
    to: number;
}