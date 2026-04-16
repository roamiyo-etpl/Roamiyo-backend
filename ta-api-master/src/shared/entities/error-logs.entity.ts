import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('error_logs')
export class ErrorLogs {
    @PrimaryGeneratedColumn()
    log_id: string;

    @Column('smallint', { comment: '1 = errors' })
    logs_type: number;

    @Column('varchar', { length: 100, nullable: true })
    searchReqId: string;

    @Column('text')
    response: string;

    @Column('smallint', { comment: '0 = not sent, 1 = email sent', default: 0 })
    is_email: number;

    @Column('varchar', { length: 50 })
    date: string;
}
