import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * City Entity - represents city data
 * @author Prashant - TBO Integration
 */
@Entity('city')
export class CityEntity {
    @PrimaryGeneratedColumn({ name: 'city_id', type: 'int' })
    cityId: number;

    @Column({ name: 'city_name', type: 'varchar', length: 100 })
    cityName: string;

    //tbo city code for searching hotel
    @Column({name: 'city_code_tbo', type: 'varchar', length: 100})
    cityCodeTbo: string;

    @Column({ name: 'state_id', type: 'int' })
    stateId: number;

    @Column({ name: 'state_code', type: 'varchar', length: 10 })
    stateCode: string;

    @Column({ name: 'state_name', type: 'varchar', length: 100 })
    stateName: string;

    @Column({ name: 'country_id', type: 'int' })
    countryId: number;

    @Column({ name: 'country_code', type: 'varchar', length: 10 })
    countryCode: string;

    @Column({ name: 'country_name', type: 'varchar', length: 100 })
    countryName: string;

    @Column({ name: 'latitude', type: 'double precision' })
    latitude: number;

    @Column({ name: 'longitude', type: 'double precision' })
    longitude: number;

    @Index('idx_city_vector', { synchronize: false })
    @Column({ name: 'city_vector', type: 'tsvector', nullable: true })
    cityVector: string | null;

    @Index('idx_city_name_normalized', { synchronize: false })
    @Column({ name: 'city_name_normalized', type: 'varchar', length: 100, nullable: true })
    cityNameNormalized: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;

    @Column({ name: 'hotel_dump_updated_at', type: 'timestamp', nullable: true })
    hotelDumpUpdatedAt: Date | null;
}
 