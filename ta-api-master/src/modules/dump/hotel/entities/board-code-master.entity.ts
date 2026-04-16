import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Board Code Master Entity - Master data for meal plan/board codes
 * @author Pravin Suthar - 25-09-2025
 */
@Entity('board_code_master')
export class BoardCodeMasterEntity {
    @PrimaryGeneratedColumn('uuid')
    boardCodeId: string;

    @Column({ name: 'alias', type: 'varchar', length: 100 })
    alias: string;

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
