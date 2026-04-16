import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AmenityMasterEntity } from './amenity-master.entity';

/**
 * Amenity Mapping Entity - Maps master amenities to supplier-specific codes
 * @author Pravin Suthar - 25-09-2025
 */
@Entity('amenity_mapping')
@Index(['amenityId'])
@Index(['code', 'supplierCode'])
@Index(['supplierCode', 'groupCode'])
@Index(['title'])
export class AmenityMappingEntity {
    @PrimaryGeneratedColumn('uuid')
    amenityMappingId: string;

    @Column({ name: 'amenity_id', type: 'uuid' })
    amenityId: string;

    @Column({ name: 'code', type: 'varchar', length: 50 })
    code: string;

    @Column({ name: 'title', type: 'varchar', length: 255 })
    title: string;

    @Column({ name: 'title_english', type: 'varchar', length: 255 })
    titleEnglish: string;

    @Column({ name: 'supplier_code', type: 'varchar', length: 50 })
    supplierCode: string;

    @Column({ name: 'group_code', type: 'varchar', length: 50 })
    groupCode: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
    updatedAt: Date;

    // Relationship with AmenityMasterEntity
    @ManyToOne(() => AmenityMasterEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'amenity_id' })
    amenityMaster: AmenityMasterEntity;
}
