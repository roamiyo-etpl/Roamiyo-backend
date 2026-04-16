import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type IsActive = 'Active' | 'Inactive';
export type ProviderMode = 'Test' | 'Production';
export type ModuleType = 'Hotel' | 'Flight';

@Entity('provider_master')
export class ProviderMaster {
    @PrimaryGeneratedColumn()
    provider_id: number;

    @Column('varchar', { length: 100 })
    name: string;

    @Column('varchar', { length: 20 })
    code: string;

    @Column({
        type: 'enum',
        enum: ['Test', 'Production'],
        default: 'Test',
    })
    provider_mode: ProviderMode;

    @Column('text', { nullable: true })
    provider_credentials: string;

    @Column({
        type: 'enum',
        enum: ['Active', 'Inactive'],
        default: 'Active',
    })
    is_active: IsActive;

    @Column('text', { nullable: true })
    authToken: string;

    @Column({
        type: 'enum',
        enum: ['Hotel', 'Flight'],
        default: 'Flight',
    })
    module_type: ModuleType;

    @Column({ name: 'token_updated_at', type: 'varchar', length: 255, nullable: true })
    tokenUpdatedAt: string;

    @Column('integer', { nullable: true })
    updated_by: number;

    @Column('timestamp', { nullable: true })
    updated_at: string;
}
