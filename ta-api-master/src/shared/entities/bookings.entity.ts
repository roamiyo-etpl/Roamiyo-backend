import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, BaseEntity, ManyToOne, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { FrontendModule } from './frontend-module.entity';
import { BookingAdditionalDetail } from './booking-additional-details.entity';
import { GenderEnum } from '../enums/accounts.enum';

// Interfaces
export interface ContactDetails {
    title: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    gender: GenderEnum;
    email: string;
    dialCode: string;
    mobileNo: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
}

export interface PassengerTypeDetails {
    count: number;
    data?: paxesData[];
}

export interface paxesData {
    guestId?: number;
    type?: string;
    age?: number;
    dob?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    mobileNo?: string;
    dialCode?: string;
    title?: string;
    roomId?: number;
    email?: string;    
    pan?: string;
    passportNumber?: string;
    passportIssueDate?: string;
    passportExpDate?: string;
    passportIssuingCountry?: string;
    nationality?: string;
}
export interface PaxGroup {
    adult: PassengerTypeDetails;
    child: PassengerTypeDetails;
    infant: PassengerTypeDetails;
}

interface Discounts {
    turbo: string;
    elite: string;
    newMember: string;
    special: string;
}

interface AppliedCouponDetails {
    couponCode: string;
    couponId: number;
    appliedDiscount: string;
}


interface UserInfo {
    id: string;
    email: string;
    name: string;
}

interface GuestAccount {
    guest_id: number;
}

// Enums
export enum BookingStatus {
    PENDING = 0,
    CONFIRMED = 1,
    BOOKED = 2,
    CANCELLED = 3,
    FAILED = 4,
    DATES_NOT_AVAILABLE = 5,
    DEPOSIT = 6,
    INPROGRESS = 9,
}

export enum PaymentMethod {
    CARD = 'card',
    COUPON = 'coupon',
    COMBINED = 'combined',
}

export enum PayMode {
    CASH = 'cash',
    COUPON = 'coupon',
    LP = 'lp',
    TC = 'tc',
}

export enum FailureReason {
    PAYMENT = 1,
    SUPPLIER_API = 2,
    INSUFFICIENT_TC = 3,
    INSUFFICIENT_LP = 4,
    OTHER = 5,
}

export enum BookingFrom {
    WEB = 'web',
    MOBILE = 'mobile',
}

export enum JourneyType {
    ONEWAY = 'oneway',
    ROUNDTRIP = 'roundtrip',
    MULTI_CITY = 'multi-city',
}

@Entity('bookings')
@Index(['booking_reference_id'], { unique: true })
export class Booking extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    booking_id: string;

    @Column({ type: 'varchar', length: 30, nullable: false, unique: true })
    booking_reference_id: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    supplier_reference_id: string;

    @Column({ type: 'integer', nullable: false })
    legacy_booking_id: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    search_id: string;

    @Column({ type: 'timestamptz', nullable: false })
    booking_date: Date;

    @Column({ type: 'uuid', nullable: false })
    @Index()
    user_id: string;

    @Column({ type: 'integer', nullable: true })
    @Index()
    account_id: number;

    @Column({ type: 'jsonb' })
    contact_details: ContactDetails;

    @Column({ type: 'varchar', length: 50, nullable: false })
    supplier_name: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    reference_id: string;

    // Foreign key relationship to frontend_module table
    // @ManyToOne(() => FrontendModule, { nullable: false })
    // @JoinColumn({ name: 'module_type', referencedColumnName: 'frontend_module_id' })
    // module: FrontendModule;

    @Column({ type: 'integer', nullable: false })
    module_type: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    guest_name: string;

    @Column({ type: 'jsonb', nullable: true })
    guest_account_id: GuestAccount[];

    @Column({ type: 'integer', nullable: true })
    item_id: number;

    @Column({ type: 'integer', nullable: true })
    sub_item_id: number;

    @Column({ type: 'enum', enum: BookingStatus, nullable: false })
    booking_status: BookingStatus;

    @Column({ type: 'varchar', length: 50, nullable: true })
    gateway_name: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    transaction_id: string;

    @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
    payment_method: PaymentMethod;

    @Column({ type: 'enum', enum: PayMode, array: true, nullable: true })
    pay_mode: PayMode[];

    @Column({ type: 'text', array: true, nullable: true })
    destination_country: string[];

    @Column({ type: 'text', array: true, nullable: true })
    destination_city: string[];

    @Column({ type: 'text', array: true, nullable: true })
    destination_code: string[];

    @Column({ type: 'text', array: true, nullable: true })
    origin_country: string[];

    @Column({ type: 'text', array: true, nullable: true })
    origin_city: string[];

    @Column({ type: 'text', array: true, nullable: true })
    origin_code: string[];

    @Column({ type: 'timestamp', nullable: true })
    checkin: Date;

    @Column({ type: 'timestamp', nullable: true })
    checkout: Date;

    @Column({ type: 'enum', enum: FailureReason, nullable: true })
    failure_reason: FailureReason;

    @Column({ type: 'enum', enum: BookingFrom, nullable: true })
    booking_from: BookingFrom;

    @Column({ type: 'enum', enum: JourneyType, nullable: true })
    journey_type: JourneyType;

    @Column({ type: 'integer', nullable: true })
    number_of_nights: number;

    @Column({ type: 'jsonb', nullable: true })
    paxes: PaxGroup[];

    @Column({ type: 'boolean', default: false })
    is_verified: boolean;

    @Column({ type: 'varchar', length: 50, nullable: true })
    mwr_log_id: string;

    @Column({ type: 'float', nullable: true })
    total: number;

    @Column({ type: 'float', nullable: true })
    public_price: number;

    @Column({ type: 'float', nullable: true })
    net_price: number;

    @Column({ type: 'float', nullable: true })
    cash_amount: number;

    @Column({ type: 'float', nullable: true })
    tax: number;

    @Column({ type: 'varchar', length: 10, nullable: true })
    currency_code: string;

    @Column({ type: 'float', nullable: true })
    live_currency_rate: number;

    @Column({ type: 'jsonb', nullable: true })
    discounts: Discounts;

    @Column({ type: 'float', nullable: true })
    savings_amount: number;

    @Column({ type: 'numeric', nullable: true })
    savings_percentage: number;

    @Column({ type: 'jsonb', nullable: true })
    applied_coupon_details: AppliedCouponDetails;

    @Column({ type: 'numeric', nullable: true })
    applied_lp: number;

    @Column({ type: 'numeric', nullable: true })
    applied_tc: number;

    @Column({ type: 'boolean', default: false })
    is_refundable: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

    @Column({ type: 'simple-json', nullable: true })
    created_by: UserInfo;

    @Column({ type: 'simple-json', nullable: true })
    updated_by: UserInfo;

    @OneToOne(() => BookingAdditionalDetail, (bookingAdditionalDetail) => bookingAdditionalDetail.booking)
    bookingAdditionalDetails: BookingAdditionalDetail;
}
