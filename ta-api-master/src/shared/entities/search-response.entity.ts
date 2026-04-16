import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('search_response')
export class SearchResponse {
    @PrimaryGeneratedColumn()
    id: string;

    @Index()
    @Column('varchar', { length: 255 })
    search_id: string;

    @Column('varchar', { length: 50 })
    provider_name: string;

    @Column('text')
    response: string;

    @Column('smallint', { default: 0 })
    provider_count: number;

    @Column('smallint', { comment: '0 = pending, 1 = response returned' })
    status: number;

    @Column('varchar', { length: 50 })
    date: string;
}
