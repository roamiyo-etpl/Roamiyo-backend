import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('revalidate_response')
export class RevalidateResponseEntity {
    @PrimaryGeneratedColumn()
    id: string;

    @Column('varchar')
    solution_id: string;

    @Column('text')
    response: string;

    @Column('varchar')
    provider_code: string;

    @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
