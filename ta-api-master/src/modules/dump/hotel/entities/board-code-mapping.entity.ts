import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BoardCodeMasterEntity } from './board-code-master.entity';

/**
 * Board Code Mapping Entity - Maps master board codes to supplier-specific codes
 * @author Pravin Suthar - 25-09-2025
 */
@Entity('board_code_mapping')
export class BoardCodeMappingEntity {
    @PrimaryGeneratedColumn('uuid')
    boardCodeMappingId: string;

    @Column({ name: 'board_code_id', type: 'uuid' })
    boardCodeId: string;

    @Column({ name: 'supplier_code', type: 'varchar', length: 50 })
    supplierCode: string;

    @Column({ name: 'board_code', type: 'varchar', length: 50 })
    boardCode: string;

    @Column({ name: 'supplier_title', type: 'varchar', length: 255 })
    supplierTitle: string;

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

    // Relationship with BoardCodeMasterEntity
    @ManyToOne(() => BoardCodeMasterEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'board_code_id' })
    boardCodeMaster: BoardCodeMasterEntity;
}
