import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('tbo_hotel_content')
@Index(['hotelCode'])
@Index(['city', 'state', 'country'])
@Index(['rating'])
export class TboHotelContentEntity {
    @PrimaryGeneratedColumn({ name: 'id' })
    id: number;

    @Column({ name: 'hotel_code', type: 'varchar', length: 50, unique: true })
    hotelCode: string;

    @Column({ name: 'hotel_name', type: 'varchar', length: 255 })
    hotelName: string;

    @Column({ name: 'rating', type: 'int', nullable: true })
    rating: number;

    @Column({ name: 'latitude', type: 'varchar', length: 20, nullable: true })
    latitude: string;

    @Column({ name: 'longitude', type: 'varchar', length: 20, nullable: true })
    longitude: string;

    @Column({ name: 'address', type: 'varchar', length: 500, nullable: true })
    address: string;

    @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
    city: string;

    @Column({ name: 'state', type: 'varchar', length: 100, nullable: true })
    state: string;

    @Column({ name: 'country', type: 'varchar', length: 100, nullable: true })
    country: string;

    @Column({ name: 'city_code', type: 'varchar', length: 10, nullable: true })
    cityCode: string;

    @Column({ name: 'state_code', type: 'varchar', length: 10, nullable: true })
    stateCode: string;

    @Column({ name: 'country_code', type: 'varchar', length: 10, nullable: true })
    countryCode: string;

    @Column({ name: 'pincode', type: 'varchar', length: 20, nullable: true })
    pincode: string;

    @Column({ name: 'hero_image', type: 'varchar', length: 500, nullable: true })
    heroImage: string;

    @Index('idx_hotel_vector', { synchronize: false })
    @Column({ name: 'hotel_vector', type: 'tsvector', nullable: true })
    hotelVector: string | null = null;

    @Index('idx_hotel_name_normalized', { synchronize: false })
    @Column({ name: 'hotel_name_normalized', type: 'varchar', length: 255, nullable: true })
    hotelNameNormalized: string | null = null;
}
