import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('supplier_log_flight')
export class SupplierLogFlight extends BaseEntity {
    @PrimaryGeneratedColumn()
    supplier_log_id: number;

    @Column('varchar', { length: 50, nullable: true })
    log_id: string;

    @Column('varchar', { length: 50 })
    title: string;

    @Index()
    @Column('uuid')
    search_req_id: string;

    @Column('varchar', { length: 50, nullable: true })
    booking_reference_id: string;

    @Column({ type: 'varchar', length: 500 })
    path_url: string;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;
}
