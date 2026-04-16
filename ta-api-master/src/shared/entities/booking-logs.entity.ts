import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum PaymentStatus {
    DEFAULT = 'DEFAULT',
    PENDING = 'PENDING',
    CAPTURED = 'CAPTURED',
    VOIDED = 'VOIDED',
    FAILED = 'FAILED',
}

@Entity('booking_log')
export class BookingLog {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column({ type: 'varchar', length: 50 })
    log_id: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    booking_reference_id: string;

    @Index()
    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'jsonb' })
    data: Record<string, any>;

    @Column({ type: 'boolean' })
    is_verified: boolean;

    @Column({
        type: 'enum',
        enum: PaymentStatus,
        default: PaymentStatus.DEFAULT,
    })
    payment_status: PaymentStatus;

    @Column({ type: 'varchar', length: 50, nullable: true })
    transaction_id: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;
}
