import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, JoinColumn, BaseEntity, OneToOne } from 'typeorm';
import { Booking } from './bookings.entity';

// Interfaces
interface PaymentLog {
    [key: string]: any; // Flexible structure for payment gateway logs
}

interface SupplierResponse {
    [key: string]: any; // Flexible structure for supplier responses
}

interface ApiResponse {
    [key: string]: any; // Flexible structure for API responses
}

interface BookingExtras {
    isCongratsPopup?: boolean;
    isTicketGenerated?: boolean;
    [key: string]: any; // Allow additional properties
}

interface RoomInfo {
    [key: string]: any; // Flexible structure for room details
}

interface PreBookDetails {
    preBookStatus: string;
    [key: string]: any; // Allow additional properties
}

interface SharedBookingDetails {
    isShared: boolean;
    sharedBookingCode: string;
    sharedBookingStatus: string;
    [key: string]: any; // Allow additional properties
}

interface PassportDocumentData {
    documentNumber: string;
    documentExpiryDate: string;
    passportIssuingCountry: string;
}

interface AdminPaymentDetails {
    paymentGatewayName: string;
    transactionId: string;
    payment_logs: any;
    [key: string]: any; // Allow additional properties
}

interface GSTDetails {
    gstCompanyAddress?: string;
    gstCompanyContactNumber?: string;
    gstCompanyName?: string;
    gstNumber?: string;
    gstCompanyEmail?: string;
}

interface UserInfo {
    id: string;
    email: string;
    name: string;
}

// Enums
export enum AddBookingType {
    DEFAULT_BOOKING = 'default booking',
    MANUALLY_BOOKING = 'manually booking',
}

@Entity('bookings_additional_detail')
export class BookingAdditionalDetail extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    booking_detail_id: string;

    @Column({ type: 'uuid', nullable: false })
    booking_id: string;

    @OneToOne(() => Booking, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'booking_id' })
    booking: Booking;

    @Column({ type: 'varchar', length: 255, nullable: false })
    booking_reference_id: string;

    @Column({ type: 'numeric', nullable: false, default: 1 })
    booking_item: number;

    @Column({ type: 'text', nullable: true })
    customer_comment: string;

    @Column({ type: 'text', nullable: true })
    admin_comment: string;

    @Column({ type: 'text', nullable: true })
    additional_notes: string;

    @Column({
        type: 'enum',
        enum: AddBookingType,
        default: AddBookingType.DEFAULT_BOOKING,
    })
    add_booking_type: AddBookingType;

    @Column({ type: 'jsonb', nullable: true })
    payment_logs: PaymentLog;

    @Column({ type: 'jsonb', nullable: true })
    supplier_response: SupplierResponse;

    @Column({ type: 'jsonb', nullable: true })
    api_response: ApiResponse;

    @Column({ type: 'text', nullable: true })
    terms_cancellation_policy: string;

    @Column({ type: 'jsonb', nullable: true })
    booking_extras: BookingExtras;

    @Column({ type: 'jsonb', nullable: true })
    room_info: RoomInfo;

    @Column({ type: 'jsonb', nullable: true })
    pre_book_details: PreBookDetails;

    @Column({ type: 'jsonb', nullable: true })
    shared_booking_details: SharedBookingDetails;

    @Column({ type: 'jsonb', nullable: true })
    passport_document_data: PassportDocumentData;

    @Column({ type: 'jsonb', nullable: true })
    admin_payment_details: AdminPaymentDetails;

    @Column({ type: 'jsonb', nullable: true })
    gst_details: GSTDetails;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

    @Column({ type: 'simple-json', nullable: true })
    created_by: UserInfo;

    @Column({ type: 'simple-json', nullable: true })
    updated_by: UserInfo;
}
