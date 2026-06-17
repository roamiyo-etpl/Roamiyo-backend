import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ssr_response_cache')
@Index(['trace_id', 'result_index'], { unique: true })
export class SsrResponseCacheEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  trace_id: string;

  @Column('text')
  result_index: string;

  @Column('text')
  response: string;

  @Column('varchar', { default: 'TBO' })
  provider_code: string;

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
