import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity, Index } from 'typeorm';
import { Booking } from './bookings.entity';

// Enums
export enum CancellationStatusEnum {
    Unassigned = 0,
    Assigned = 1,
    Acknowledged = 2,
    Completed = 3,
    Rejected = 4,
    Closed = 5,
    Pending = 6,
    Other = 7,
}

export enum CancellationRequestType {
    FullCancellation = 1,
    PartialCancellation = 2,
    Reissuance = 3,
}

export enum CancellationTypeEnum {
    NotSet = 0,
    NoShow = 1,
    FlightCancelled = 2,
    Others = 3,
}

// Interfaces
interface UserInfo {
    id: string;
    email: string;
    name: string;
}

/**
 * Cancellation Entity
 * Stores all cancellation attempts for a booking
 * A booking can have multiple cancellation records (one per cancellation attempt)
 */
@Entity('cancellations')
@Index(['booking_id'])
@Index(['change_request_id'])
export class Cancellation extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    cancellation_id: string;

    // Foreign key to booking
    @Column({ type: 'uuid', nullable: false })
    booking_id: string;

    @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'booking_id' })
    booking: Booking;

    // Booking reference for easy lookup
    @Column({ type: 'varchar', length: 30, nullable: false })
    booking_reference_id: string;

    // Supplier booking ID
    @Column({ type: 'varchar', length: 255, nullable: true })
    supplier_reference_id: string;

    // Ticket ID(s) - can be single or array for partial cancellations
    @Column({ type: 'jsonb', nullable: true })
    ticket_ids: number[] | null;

    // Change request ID from supplier
    @Column({ type: 'bigint', nullable: true })
    change_request_id: number | null;

    // Trace ID from supplier
    @Column({ type: 'varchar', length: 255, nullable: true })
    trace_id: string | null;

    // Cancellation date
    @Column({ type: 'timestamptz', nullable: false })
    cancel_date: Date;

    // Cancellation status (enum)
    @Column({ type: 'enum', enum: CancellationStatusEnum, nullable: true })
    status: CancellationStatusEnum | null;

    // Cancellation charge
    @Column({ type: 'float', nullable: true })
    cancellation_charge: number | null;

    // Refunded amount
    @Column({ type: 'float', nullable: true })
    refunded_amount: number | null;

    // Remarks
    @Column({ type: 'text', nullable: true })
    remarks: string | null;

    // Request type (FullCancellation, PartialCancellation, Reissuance)
    @Column({ type: 'enum', enum: CancellationRequestType, nullable: true })
    request_type: CancellationRequestType | null;

    // Cancellation type (NoShow, FlightCancelled, Others)
    @Column({ type: 'enum', enum: CancellationTypeEnum, nullable: true })
    cancellation_type: CancellationTypeEnum | null;

    // Credit note number
    @Column({ type: 'varchar', length: 255, nullable: true })
    credit_note_no: string | null;

    // Credit note creation date
    @Column({ type: 'timestamptz', nullable: true })
    credit_note_created_on: Date | null;

    // Additional flexible fields for future use
    @Column({ type: 'jsonb', nullable: true })
    additional_data: any;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

    @Column({ type: 'simple-json', nullable: true })
    created_by: UserInfo;

    @Column({ type: 'simple-json', nullable: true })
    updated_by: UserInfo;
}

