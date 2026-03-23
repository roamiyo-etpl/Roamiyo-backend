import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { TboHotelImagesEntity } from './tbo-hotel-images.entity';

/**
 * Hotelbeds Additional Hotel Details Entity - Comprehensive hotel information for detail pages
 * @author Pravin Suthar - 25-09-2025
 */
@Entity('tbo_additional_hotel_details')
@Index(['hotelCode', 'supplierCode'])
@Index(['city', 'state', 'country'])
@Index(['rating'])
@Index(['hotelVector'])
@Index(['hotelNameNormalized'])
export class TboHotelAdditionalDetailsEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'hotel_code', type: 'varchar', length: 50, unique: true })
    hotelCode: string;

    @Column({ name: 'supplier_code', type: 'varchar', length: 50 })
    supplierCode: string;

    @Column({ name: 'hotel_name', type: 'varchar', length: 255 })
    hotelName: string;

    @Column({ name: 'rating', type: 'int', nullable: true })
    rating: number;

    @Column({ name: 'latitude', type: 'varchar', length: 50, nullable: true })
    latitude: string;

    @Column({ name: 'longitude', type: 'varchar', length: 50, nullable: true })
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

    @Column({ name: 'amenities', type: 'jsonb', nullable: true })
    amenities: [];

    @Column({ name: 'description', type: 'jsonb', nullable: true })
    description: [];

    @Column({ name: 'hotel_email', type: 'varchar', length: 255, nullable: true })
    hotelEmail: string;

    @Column({ name: 'hotel_phones', type: 'jsonb', nullable: true })
    hotelPhones: any;

    @Column({ name: 'board_codes', type: 'jsonb', nullable: true })
    boardCodes: [];

    @Column({ name: 'website_url', type: 'varchar', length: 500, nullable: true })
    websiteUrl: string;

    @Column({ name: 'interest_points', type: 'jsonb', nullable: true })
    interestPoints: any;

    @Column({ name: 'terminals', type: 'jsonb', nullable: true })
    terminals: [];

    @Column({ name: 'status', type: 'enum', enum: ['PENDING', 'COMPLETE'], default: 'PENDING' })
    status: 'PENDING' | 'COMPLETE';

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
    updatedAt: Date;

    // Relationship with hotel images
    @OneToMany(() => TboHotelImagesEntity, (image) => image.hotel)
    images: TboHotelImagesEntity[];

    @Column({ name: 'hotel_vector', type: 'tsvector', nullable: true })
    hotelVector: string | null = null;

    @Column({ name: 'hotel_name_normalized', type: 'varchar', length: 255, nullable: true })
    hotelNameNormalized: string | null = null;
}
 