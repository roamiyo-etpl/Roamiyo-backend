import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Amenity Master Entity - Master data for hotel amenities
 * @author Pravin Suthar - 25-09-2025
 */
@Entity('amenity_master')
@Index(['titleEnglish'])
@Index(['isDeleted'])
export class AmenityMasterEntity {
    @PrimaryGeneratedColumn('uuid')
    amenityId: string;

    @Column({ name: 'title_english', type: 'varchar', length: 255 })
    titleEnglish: string;

    @Column({ name: 'is_deleted', type: 'boolean', default: false })
    isDeleted: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
    updatedAt: Date;

    @Column({ name: 'created_by', type: 'jsonb', nullable: true })
    createdBy: {
        id: string;
        name: string;
        email: string;
    };

    @Column({ name: 'updated_by', type: 'jsonb', nullable: true })
    updatedBy: {
        id: string;
        name: string;
        email: string;
    };
}
