import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * State Entity - represents state/province data
 * @author Prashant - TBO Integration
 */
@Entity('state')
export class StateEntity {
    @PrimaryGeneratedColumn({ name: 'state_id', type: 'int' })
    stateId: number;

    @Column({ name: 'state_name', type: 'varchar', length: 100 })
    stateName: string;

    @Column({ name: 'country_id', type: 'int' })
    countryId: number;

    @Column({ name: 'country_code', type: 'varchar', length: 10 })
    countryCode: string;

    @Column({ name: 'country_name', type: 'varchar', length: 100 })
    countryName: string;

    @Column({ name: 'iso2', type: 'varchar', length: 10, nullable: true })
    iso2: string | null;

    @Column({ name: 'iso3166_2', type: 'varchar', length: 10, nullable: true })
    iso3166_2: string | null;

    @Column({ name: 'fips_code', type: 'varchar', length: 10, nullable: true })
    fipsCode: string | null;

    @Column({ name: 'type', type: 'varchar', length: 50, nullable: true })
    type: string | null;

    @Column({ name: 'latitude', type: 'double precision' })
    latitude: number;

    @Column({ name: 'longitude', type: 'double precision' })
    longitude: number;

    @Column({ name: 'timezone', type: 'varchar', length: 50, nullable: true })
    timezone: string | null;
}
