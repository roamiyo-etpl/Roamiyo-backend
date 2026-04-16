import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, BaseEntity } from 'typeorm';

// Interfaces
interface UserInfo {
    id: string;
    email: string;
    name: string;
}

@Entity('frontend_module')
export class FrontendModule extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    frontend_module_id: number;

    @Column({ type: 'varchar', nullable: false })
    title: string;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: true })
    is_module: boolean;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

    @Column({ type: 'simple-json', nullable: true })
    updated_by: UserInfo;
}
