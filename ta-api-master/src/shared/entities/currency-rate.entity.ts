import { BaseEntity, BeforeUpdate, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CurrencyPlacementEnum } from '../enums/common.enum';

/* Commenting for the enum values */
const CurrencyPlacementEnumValue = Object.keys(CurrencyPlacementEnum)
    .filter((key) => isNaN(Number(CurrencyPlacementEnum[key])))
    .map((key) => `${key} = ${CurrencyPlacementEnum[key]}`)
    .join(', ');

@Entity('currency_conversion')
export class CurrencyConversionEntity extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'name', type: 'varchar', length: 100 })
    name: string;

    @Column({ name: 'symbol', type: 'varchar', length: 6 })
    symbol: string;

    @Index()
    @Column({ name: 'code', type: 'varchar', length: 10 })
    code: string;

    @Column({ name: 'base_rate_USD', type: 'float', nullable: true })
    baseRateUSD: number;

    @Column({
        name: 'symbol_placement',
        type: 'enum',
        enum: CurrencyPlacementEnum,
        default: CurrencyPlacementEnum.BEFORE,
        comment: CurrencyPlacementEnumValue,
    })
    symbolPlacement: CurrencyPlacementEnum;

    @Column({ name: 'countries', type: 'jsonb', nullable: true })
    countries: string;

    @Column({ name: 'is_active', default: true, comment: '0 = inactive, 1 = active' })
    isActive: boolean;

    @Column({ name: 'is_deleted', default: false, comment: '0 = not deleted, 1 = deleted' })
    isDeleted: boolean;

    @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMPTZ', nullable: true })
    updatedAt: Date;

    @BeforeUpdate()
    updateTimestamp() {
        this.updatedAt = new Date();
    }
}
