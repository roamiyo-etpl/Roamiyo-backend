import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { StatusEnum } from '../enums/accounts.enum';

interface UserInfo {
    id: string;
    name: string;
    email: string;
}

@Entity('airline')
export class Airline {
    @PrimaryGeneratedColumn()
    id: number;

    @Column('varchar', { length: 20 })
    code: string;

    @Column('varchar', { length: 255 })
    name: string;

    @Column('varchar', { length: 500, nullable: true })
    web_checkin_url: string;

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
