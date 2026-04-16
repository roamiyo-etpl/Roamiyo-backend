import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { StatusEnum } from '../enums/accounts.enum';

interface UserInfo {
    id: string;
    name: string;
    email: string;
}

@Entity('airports')
export class Airports {
    @PrimaryGeneratedColumn()
    id: number;

    @Column('varchar', { length: 20 })
    code: string;

    @Column('varchar', { length: 100 })
    latitude: string;

    @Column('varchar', { length: 100 })
    longitude: string;

    @Column('varchar', { length: 255 })
    name: string;

    @Column('varchar', { length: 150 })
    city: string;

    @Column('varchar', { length: 150 })
    state: string;

    @Column('varchar', { length: 150 })
    country: string;

    @Column('varchar', { length: 50, nullable: true })
    icao: string;

    //
    @Column('varchar', { length: 250, nullable: true })
    woeid: string;

    @Column('varchar', { length: 250, nullable: true })
    tz: string;

    @Column('varchar', { length: 250, nullable: true })
    phone: string;

    @Column('varchar', { length: 250, nullable: true })
    type: string;

    @Column('varchar', { length: 250, nullable: true })
    email: string;

    @Column('varchar', { length: 250, nullable: true })
    url: string;

    @Column('varchar', { length: 250, nullable: true })
    runway_length: string;

    @Column('varchar', { length: 250, nullable: true })
    elev: string;

    @Column('varchar', { length: 250, nullable: true })
    direct_flights: string;

    @Column('varchar', { length: 250, nullable: true })
    carriers: string;

    @Column('varchar', { length: 20, nullable: true })
    timezone: string;
    //

    @Column({
        type: 'enum',
        enum: StatusEnum,
        default: StatusEnum.ACTIVE,
    })
    status: StatusEnum;

    @Column({
        type: 'boolean',
        default: false,
        comment: 'This will be used for soft delete',
    })
    is_deleted: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

    @Column({ type: 'jsonb', nullable: true })
    created_by: UserInfo;

    @Column({ type: 'jsonb', nullable: true })
    updated_by: UserInfo;
}
