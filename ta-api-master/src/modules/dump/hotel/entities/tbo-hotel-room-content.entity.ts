import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Hotelbeds Hotel Room Content Entity - Stores room details and configurations from Hotelbeds Content API
 * @author Pravin Suthar - 25-09-2025
 */
@Entity('tbo_hotel_room_content')
@Index(['hotelCode', 'supplierCode'])
@Index(['hotelCode', 'roomCode'])
@Index(['roomCode', 'typeCode'])
export class TboHotelRoomContentEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'hotel_code', type: 'varchar', length: 50 })
    hotelCode: string;

    @Column({ name: 'supplier_code', type: 'varchar', length: 50 })
    supplierCode: string;

    @Column({ name: 'room_code', type: 'varchar', length: 50 })
    roomCode: string;

    @Column({ name: 'is_parent_room', type: 'boolean', default: false })
    isParentRoom: boolean;

    @Column({ name: 'min_pax', type: 'int', nullable: true })
    minPax: number;

    @Column({ name: 'max_pax', type: 'int', nullable: true })
    maxPax: number;

    @Column({ name: 'max_adults', type: 'int', nullable: true })
    maxAdults: number;

    @Column({ name: 'max_children', type: 'int', nullable: true })
    maxChildren: number;

    @Column({ name: 'min_adults', type: 'int', nullable: true })
    minAdults: number;

    @Column({ name: 'description', type: 'text', nullable: true })
    description: string;

    @Column({ name: 'type_code', type: 'varchar', length: 50, nullable: true })
    typeCode: string;

    @Column({ name: 'type_description', type: 'varchar', length: 255, nullable: true })
    typeDescription: string;

    @Column({ name: 'characteristic_code', type: 'varchar', length: 50, nullable: true })
    characteristicCode: string;

    @Column({ name: 'characteristic_description', type: 'varchar', length: 255, nullable: true })
    characteristicDescription: string;

    @Column({ name: 'room_facilities', type: 'jsonb', nullable: true })
    roomFacilities: [];

    @Column({ name: 'room_stays', type: 'jsonb', nullable: true })
    roomStays: [];

    @Column({ name: 'pms_room_code', type: 'varchar', length: 100, nullable: true })
    pmsRoomCode: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
    updatedAt: Date;
}
