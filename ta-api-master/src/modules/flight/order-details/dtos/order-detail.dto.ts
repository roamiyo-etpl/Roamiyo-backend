import { IsArray, IsNotEmpty, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SearchAirLegs {
    @IsNotEmpty()
    origin: string;

    @IsNotEmpty()
    destination: string;

    @IsNotEmpty()
    departureDate: string;
}

class BookingDetails {
    @IsNotEmpty()
    orderStatus: number;

    @IsNotEmpty()
    pnr: string;

    @IsNotEmpty()
    orderNo: string;

    @IsNotEmpty()
    firstName: string;

    @IsNotEmpty()
    lastName: string;
}

export class OrderDetailDto {
    @ApiProperty({
        description: 'Provider code',
        example: 'PK',
    })
    @IsNotEmpty()
    @IsString()
    providerCode: string;

    @ApiProperty({
        description: 'bookingDetails will be here.',
        example: [
            {
                orderStatus: 1,
                pnr: 'abcdf',
                orderNo: '12345',
                firstName: 'test',
                lastName: 'user',
            },
        ],
    })
    @ValidateNested({ each: true })
    @Type(() => BookingDetails)
    bookingDetails: BookingDetails[];

    @ApiProperty({
        description: 'Search request ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
        format: 'uuid',
    })
    @IsNotEmpty()
    @IsString()
    searchReqId: string;

    @ApiProperty({
        description: 'Search air legs information',
        type: [SearchAirLegs],
        example: [
            {
                origin: 'NYC',
                destination: 'LAX',
            },
            {
                origin: 'LAX',
                destination: 'NYC',
            },
        ],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SearchAirLegs)
    searchAirLegs: SearchAirLegs[];

    @ApiProperty({
        description: 'Provider mode',
        example: 'Test',
        enum: ['Production', 'Test', 'Sandbox'],
    })
    @IsNotEmpty()
    @IsString()
    mode: string;
}
