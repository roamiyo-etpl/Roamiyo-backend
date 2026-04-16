import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class HotelDetailRequestDto {
    @ApiProperty({
        description: 'Hotel ID',
        example: '1863197',
    })
    @IsNotEmpty()
    @IsString()
    hotelId: string;

    @ApiProperty({
        description: 'Supplier Code',
        example: 'TBO',
    })
    @IsNotEmpty()
    @IsString()
    supplierCode: string;
}

export class HotelRatingDto {
    @ApiProperty({
        description: 'Hotel star rating',
        example: 4,
    })
    stars: number;

    @ApiProperty({
        description: 'Review score',
        example: '8.5',
    })
    reviewScore: string;
}

export class HotelGeolocationDto {
    @ApiProperty({
        description: 'Latitude',
        example: '40.7580',
    })
    latitude: string;

    @ApiProperty({
        description: 'Longitude',
        example: '-73.9855',
    })
    longitude: string;
}

export class HotelDetailResponseDto {
    @ApiProperty({
        description: 'Hotel ID',
        example: '107953',
    })
    hotelId: string;

    @ApiProperty({
        description: 'Hotel name',
        example: 'Pierre & Vacances Terrazas Costa del Sol',
    })
    name: string;

    @ApiProperty({
        description: 'Hotel address',
        example: 'Avd Sierra Morena, Urbanización Bahía las Rocas, 2',
    })
    address: string;

    @ApiProperty({
        description: 'City',
        example: 'MANILVA',
    })
    city: string;

    @ApiProperty({
        description: 'State',
        example: 'MALAGA',
    })
    state: string;

    @ApiProperty({
        description: 'Country',
        example: 'Spain',
    })
    country: string;

    @ApiProperty({
        description: 'Country code',
        example: 'ES',
    })
    countryCode: string;

    @ApiProperty({
        description: 'Hotel description',
        example: 'A luxurious beachfront resort offering stunning ocean views, world-class amenities, and exceptional service in the heart of Costa del Sol.',
    })
    description: string;

    @ApiProperty({
        description: 'Hotel rating information',
        type: HotelRatingDto,
    })
    rating: HotelRatingDto;

    @ApiProperty({
        description: 'Hotel geolocation',
        type: HotelGeolocationDto,
    })
    geolocation: HotelGeolocationDto;

    @ApiProperty({
        description: 'Hotel images',
        example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        type: [String],
    })
    images: string[];

    @ApiProperty({
        description: 'Hotel amenities',
        example: ['WiFi', 'Parking', 'Pool'],
        type: [String],
    })
    amenities: string[];

    @ApiProperty({
        description: 'Points of interest',
        example: ['Beach', 'Shopping Center'],
        type: [String],
    })
    poi: string[];

    @ApiProperty({
        description: 'Neighbourhoods',
        example: ['Downtown', 'Beach Area'],
        type: [String],
    })
    neighbourhoods: string[];
}
