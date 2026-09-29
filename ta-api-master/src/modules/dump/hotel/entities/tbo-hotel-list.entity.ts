import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum PropertyTypeEnum {
    HOTEL = 'hotel',
    HOMESTAY = 'homestay',
}

const PropertyTypeEnumValue = Object.keys(PropertyTypeEnum)
    .map((key) => `${key} = ${PropertyTypeEnum[key]}`)
    .join(', ');

/**
 * TBO hotel list - static hotel / homestay data from TBO excel sheets
 */
@Entity('tbo_hotel_list')
@Index(['cityId'])
@Index(['countryCode'])
@Index(['propertyType'])
export class TboHotelListEntity {
    @PrimaryGeneratedColumn({ name: 'id' })
    id: number;

    @Column({ name: 'tbo_hotel_id', type: 'varchar', length: 50, unique: true })
    tboHotelId: string;

    @Column({ name: 'hotel_name', type: 'varchar', length: 500, nullable: true })
    hotelName: string | null;

    @Column({ name: 'address_line1', type: 'text', nullable: true })
    addressLine1: string | null;

    @Column({ name: 'address_line2', type: 'text', nullable: true })
    addressLine2: string | null;

    @Column({ name: 'city_id', type: 'varchar', length: 50, nullable: true })
    cityId: string | null;

    @Column({ name: 'city_name', type: 'varchar', length: 150, nullable: true })
    cityName: string | null;

    @Column({ name: 'country_name', type: 'varchar', length: 150, nullable: true })
    countryName: string | null;

    @Column({ name: 'country_code', type: 'varchar', length: 10, nullable: true })
    countryCode: string | null;

    @Column({ name: 'latitude', type: 'double precision', nullable: true })
    latitude: number | null;

    @Column({ name: 'longitude', type: 'double precision', nullable: true })
    longitude: number | null;

    @Column({ name: 'star_rating', type: 'smallint', nullable: true })
    starRating: number | null;

    @Column({ name: 'property_type', type: 'enum', enum: PropertyTypeEnum, default: PropertyTypeEnum.HOTEL, comment: PropertyTypeEnumValue })
    propertyType: PropertyTypeEnum;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
