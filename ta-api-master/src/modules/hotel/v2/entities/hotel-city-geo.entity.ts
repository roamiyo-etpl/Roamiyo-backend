import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * City coordinates resolved from Google Geocoding for v2 hotel autocomplete.
 * Each city is geocoded once and reused from here on.
 */
@Entity('hotel_city_geo')
export class HotelCityGeoEntity {
    /* `${countryCode}|${lower(trim(cityName))}`, e.g. "IN|new delhi" */
    @PrimaryColumn({ name: 'geo_key', type: 'varchar', length: 200 })
    geoKey: string;

    @Column({ name: 'city_name', type: 'varchar', length: 150 })
    cityName: string;

    @Column({ name: 'country_code', type: 'varchar', length: 10 })
    countryCode: string;

    @Column({ name: 'latitude', type: 'double precision' })
    latitude: number;

    @Column({ name: 'longitude', type: 'double precision' })
    longitude: number;

    @Column({ name: 'formatted_address', type: 'text', nullable: true })
    formattedAddress: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
