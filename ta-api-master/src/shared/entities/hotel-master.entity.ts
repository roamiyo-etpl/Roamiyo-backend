import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export enum StarRatingEnum {
    ONE = '1',
    TWO = '2',
    THREE = '3',
    FOUR = '4',
    FIVE = '5',
    SIX = '6',
    SEVEN = '7',
}

export enum HotelSourceEnum {
    DMC = 'dmc',
    EXTRANET = 'extranet',
    TBO = 'tbo',
    HOTELBEDS = 'hotelbeds',
}

const HotelSourceEnumValue = Object.keys(HotelSourceEnum)
    .filter((key) => isNaN(Number(HotelSourceEnum[key])))
    .map((key) => `${key} = ${HotelSourceEnum[key]}`)
    .join(', ');

const StarRatingEnumValue = Object.keys(StarRatingEnum)
    .filter((key) => isNaN(Number(StarRatingEnum[key])))
    .map((key) => `${key} = ${StarRatingEnum[key]}`)
    .join(', ');

@Entity('hotel_master')
@Unique(['hotelCode'])
export class HotelMasterEntity {
    @PrimaryGeneratedColumn('uuid', { name: 'hotel_master_id' })
    hotelMasterId: string;

    @Column({ name: 'hotel_name', type: 'varchar', length: 255, nullable: true })
    hotelName: string;

    @Column({ name: 'highlight_text', type: 'text', nullable: true })
    highlightText: string;

    @Column({ name: 'star_rating', type: 'enum', enum: StarRatingEnum, nullable: true, comment: StarRatingEnumValue })
    starRating: StarRatingEnum;

    @Column({ name: 'country_code', type: 'varchar', length: 5, nullable: true })
    countryCode: string;

    @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
    city: string;

    @Column({ name: 'state', type: 'varchar', length: 100, nullable: true })
    state: string;

    @Column({ name: 'address', type: 'text', nullable: true })
    address: string;

    @Column({ name: 'address_1', type: 'text', nullable: true })
    address1: string | null = null;

    @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
    postalCode: string;

    @Column({ name: 'latitude', type: 'double precision', nullable: true })
    latitude: number;

    @Column({ name: 'longitude', type: 'double precision', nullable: true })
    longitude: number;

    @Column({ name: 'hero_image', type: 'text', nullable: true })
    heroImage: string;

    @Column({ name: 'hotel_source', type: 'enum', enum: HotelSourceEnum, nullable: false, comment: HotelSourceEnumValue })
    hotelSource: HotelSourceEnum;

    @Column({ name: 'hotel_code', type: 'varchar', length: 50, nullable: false })
    @Index()
    hotelCode: string;

    @Column({ name: 'provider_code', type: 'varchar', length: 10, nullable: true })
    providerCode: string;

    @Column({ name: 'is_active', type: 'boolean', nullable: false, default: false })
    isActive: boolean;

    @Column({ name: 'is_deleted', type: 'boolean', nullable: false, default: false })
    isDeleted: boolean;

    @Column({ name: 'created_at', type: 'timestamptz', nullable: false })
    createdAt: Date;

    @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
    updatedAt: Date;

    @Column({ name: 'created_by', type: 'simple-json', nullable: true })
    createdBy: { id: string; email: string; name: string };

    @Column({ name: 'updated_by', type: 'simple-json', nullable: true })
    updatedBy: { id: string; email: string; name: string };
}
