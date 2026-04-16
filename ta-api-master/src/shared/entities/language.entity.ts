import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { LanguageType } from '../enums/common.enum';

/* Commenting for the enum values */
const LanguageTypeEnumValue = Object.keys(LanguageType)
    .filter((key) => isNaN(Number(LanguageType[key])))
    .map((key) => `${key} = ${LanguageType[key]}`)
    .join(', ');

@Entity('language')
export class LanguageEntity {
    @PrimaryGeneratedColumn({ name: 'id' })
    id: number;

    @Index({ unique: true })
    @Column({ name: 'key', type: 'text', unique: true, nullable: false })
    key: string;

    @Column({ name: 'english', type: 'text', nullable: false })
    english: string;

    @Column({ name: 'french', type: 'text', nullable: true })
    french: string;

    @Column({ name: 'german', type: 'text', nullable: true })
    german: string;

    @Column({ name: 'hungarian', type: 'text', nullable: true })
    hungarian: string;

    @Column({ name: 'italian', type: 'text', nullable: true })
    italian: string;

    @Column({ name: 'korean', type: 'text', nullable: true })
    korean: string;

    @Column({ name: 'portuguese', type: 'text', nullable: true })
    portuguese: string;

    @Column({ name: 'romanian', type: 'text', nullable: true })
    romanian: string;

    @Column({ name: 'russian', type: 'text', nullable: true })
    russian: string;

    @Column({ name: 'spanish', type: 'text', nullable: true })
    spanish: string;

    @Column({
        type: 'enum',
        enum: LanguageType,
        default: LanguageType.LTR,
        comment: LanguageTypeEnumValue,
    })
    type: LanguageType;

    @Column('boolean', { name: 'is_active', default: true })
    isActive!: boolean;

    @CreateDateColumn({
        type: 'timestamptz',
        name: 'created_at',
    })
    createdAt!: Date;
}
