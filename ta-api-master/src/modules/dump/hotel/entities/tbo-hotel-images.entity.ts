import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TboHotelAdditionalDetailsEntity } from './tbo-hotel-additional-details.entity';

@Entity('tbo_hotel_images')
@Index(['hotelCode', 'supplierCode'])
@Index(['hotelCode', 'typeCode'])
@Index(['hotelCode', 'order', 'visualOrder'])
export class TboHotelImagesEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'hotel_code', type: 'varchar', length: 50 })
    hotelCode: string;

    @Column({ name: 'supplier_code', type: 'varchar', length: 50 })
    supplierCode: string;

    @Column({ name: 'type_code', type: 'varchar', length: 50 })
    typeCode: string;

    @Column({ name: 'type_name', type: 'varchar', length: 50, nullable: true })
    typeName: string;

    @Column({ name: 'room_code', type: 'varchar', length: 50, nullable: true })
    roomCode: string;

    @Column({ name: 'room_type', type: 'varchar', length: 100, nullable: true })
    roomType: string;

    @Column({ name: 'url', type: 'varchar', length: 500 })
    url: string;

    @Column({ name: 'order', type: 'int', nullable: true })
    order: number;

    @Column({ name: 'visual_order', type: 'int', nullable: true })
    visualOrder: number;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
    updatedAt: Date;

    // Relationship with hotel details
    @ManyToOne(() => TboHotelAdditionalDetailsEntity, (hotel) => hotel.images)
    @JoinColumn({ name: 'hotel_code', referencedColumnName: 'hotelCode' })
    hotel: TboHotelAdditionalDetailsEntity;
}
