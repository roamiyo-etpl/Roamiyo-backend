import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Country Entity - represents country data
 * @author Prashant - TBO Integration
 */
@Entity('country')
export class CountryEntity {
    @PrimaryGeneratedColumn({ name: 'country_id', type: 'int' })
    countryId: number;

    @Column({ name: 'country_name', type: 'varchar', length: 100 })
    countryName: string;

    @Column({ name: 'iso3', type: 'varchar', length: 10, nullable: true })
    iso3: string | null;

    @Column({ name: 'iso2', type: 'varchar', length: 10 })
    iso2: string;

    @Column({ name: 'numeric_code', type: 'varchar', length: 10, nullable: true })
    numericCode: string | null;

    @Column({ name: 'phonecode', type: 'varchar', length: 10, nullable: true })
    phonecode: string | null;

    @Column({ name: 'capital', type: 'varchar', length: 100, nullable: true })
    capital: string | null;

    @Column({ name: 'currency', type: 'varchar', length: 10, nullable: true })
    currency: string | null;

    @Column({
        name: 'currency_name',
        type: 'varchar',
        length: 100,
        nullable: true,
    })
    currencyName: string | null;

    @Column({
        name: 'currency_symbol',
        type: 'varchar',
        length: 10,
        nullable: true,
    })
    currencySymbol: string | null;

    @Column({ name: 'population', type: 'int', nullable: true })
    population: number | null;

    @Column({ name: 'gdp', type: 'int', nullable: true })
    gdp: number | null;

    @Column({ name: 'region', type: 'varchar', length: 100, nullable: true })
    region: string | null;

    @Column({ name: 'region_id', type: 'int', nullable: true })
    regionId: number | null;

    @Column({ name: 'subregion', type: 'varchar', length: 100, nullable: true })
    subregion: string | null;

    @Column({ name: 'subregion_id', type: 'int', nullable: true })
    subregionId: number | null;

    @Column({ name: 'nationality', type: 'varchar', length: 100, nullable: true })
    nationality: string | null;

    @Column({ name: 'timezones', type: 'jsonb', nullable: true })
    timezones:
        | {
              zoneName: string;
              gmtOffset: number;
              gmtOffsetName: string;
              abbreviation: string;
              tzName: string;
          }[]
        | null;

    @Column({ name: 'translations', type: 'jsonb', nullable: true })
    translations: object | null;

    @Column({ name: 'latitude', type: 'double precision', nullable: true })
    latitude: number | null;

    @Column({ name: 'longitude', type: 'double precision', nullable: true })
    longitude: number | null;

    @Column({ name: 'emojiU', type: 'varchar', length: 20, nullable: true })
    emojiU: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
 