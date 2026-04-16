import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelMasterEntity } from 'src/shared/entities/hotel-master.entity';

/**
 * TBO Repository for hotel data operations
 * Enhanced following chatdmc-traveltekpro pattern
 * Handles database queries for hotel information
 * @author Prashant - TBO Integration
 */
@Injectable()
export class TboRepository {
    constructor(
        @InjectRepository(HotelMasterEntity)
        private readonly hotelMasterRepo: Repository<HotelMasterEntity>,
    ) {}

    /**
     * Find hotels by city name
     * @param cityName - City name to search for
     * @returns Promise<HotelMasterEntity[]> - Array of hotels
     */
    async findHotelsByCity(cityName: string): Promise<HotelMasterEntity[]> {
        try {
            return await this.hotelMasterRepo
                .createQueryBuilder('hotel')
                .where('LOWER(hotel.city) LIKE LOWER(:cityName)', { cityName: `%${cityName}%` })
                .andWhere('hotel.isActive = :isActive', { isActive: true })
                .andWhere('hotel.isDeleted = :isDeleted', { isDeleted: false })
                .andWhere('hotel.providerCode = :providerCode', { providerCode: 'TBO' })
                .getMany();
        } catch (error) {
            console.error('Error finding hotels by city:', error);
            throw new BadRequestException('Failed to find hotels by city');
        }
    }

    /**
     * Find hotels by city ID
     * @param cityId - City ID to search for
     * @returns Promise<HotelMasterEntity[]> - Array of hotels
     */
    async findHotelsByCityId(cityId: string): Promise<HotelMasterEntity[]> {
        try {
            return await this.hotelMasterRepo
                .createQueryBuilder('hotel')
                .where('hotel.city = :cityId', { cityId })
                .andWhere('hotel.isActive = :isActive', { isActive: true })
                .andWhere('hotel.isDeleted = :isDeleted', { isDeleted: false })
                .andWhere('hotel.providerCode = :providerCode', { providerCode: 'TBO' })
                .getMany();
        } catch (error) {
            console.error('Error finding hotels by city ID:', error);
            throw new BadRequestException('Failed to find hotels by city ID');
        }
    }

    /**
     * Find hotels by hotel codes
     * @param hotelCodes - Array of hotel codes
     * @returns Promise<HotelMasterEntity[]> - Array of hotels
     */
    async findHotelsByHotelCode(hotelCodes: string[]): Promise<HotelMasterEntity[]> {
        try {
            if (!hotelCodes || hotelCodes.length === 0) {
                return [];
            }

            return await this.hotelMasterRepo
                .createQueryBuilder('hotel')
                .where('hotel.hotelCode IN (:...hotelCodes)', { hotelCodes })
                .andWhere('hotel.isActive = :isActive', { isActive: true })
                .andWhere('hotel.isDeleted = :isDeleted', { isDeleted: false })
                .andWhere('hotel.providerCode = :providerCode', { providerCode: 'TBO' })
                .getMany();
        } catch (error) {
            console.error('Error finding hotels by hotel code:', error);
            throw new BadRequestException('Failed to find hotels by hotel code');
        }
    }

    /**
     * Find hotel details by hotel code
     * @param hotelCode - Hotel code to search for
     * @returns Promise<HotelMasterEntity | null> - Hotel details or null
     */
    async findHotelDetailsByHotelCode(hotelCode: string): Promise<HotelMasterEntity | null> {
        try {
            return await this.hotelMasterRepo
                .createQueryBuilder('hotel')
                .where('hotel.hotelCode = :hotelCode', { hotelCode })
                .andWhere('hotel.isActive = :isActive', { isActive: true })
                .andWhere('hotel.isDeleted = :isDeleted', { isDeleted: false })
                .andWhere('hotel.providerCode = :providerCode', { providerCode: 'TBO' })
                .getOne();
        } catch (error) {
            console.error('Error finding hotel details by hotel code:', error);
            throw new BadRequestException('Failed to find hotel details by hotel code');
        }
    }

    /**
     * Find hotels by map coordinates with radius
     * @param map - Map coordinates with lat and lng
     * @param radiusInKm - Radius in kilometers (default: 50km)
     * @returns Promise<HotelMasterEntity[]> - Array of hotels within radius
     */
    async findHotelsByMap(map: { lat: number; lng: number }, radiusInKm: number = 50): Promise<HotelMasterEntity[]> {
        const { lat, lng } = map;

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new BadRequestException('Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180');
        }

        try {
            // Using Haversine formula for distance calculation
            const query = `
                SELECT *,
                (6371 * acos(
                    cos(radians($1)) * 
                    cos(radians(latitude)) * 
                    cos(radians(longitude) - radians($2)) + 
                    sin(radians($1)) * 
                    sin(radians(latitude))
                )) AS distance
                FROM hotel_master 
                WHERE is_active = true 
                AND is_deleted = false 
                AND provider_code = 'TBO'
                AND latitude IS NOT NULL 
                AND longitude IS NOT NULL
                HAVING distance < $3
                ORDER BY distance
            `;

            return await this.hotelMasterRepo.query(query, [lat, lng, radiusInKm]);
        } catch (error) {
            console.error('Error finding hotels by map:', error);
            throw new BadRequestException('Failed to find hotels by map coordinates');
        }
    }

    /**
     * Find hotel by code (alias for findHotelDetailsByHotelCode)
     * @param hotelCode - Hotel code to search for
     * @returns Promise<HotelMasterEntity | null> - Hotel details or null
     */
    async findHotelByCode(hotelCode: string): Promise<HotelMasterEntity | null> {
        return this.findHotelDetailsByHotelCode(hotelCode);
    }

    /**
     * Find hotels by name (partial match)
     * @param hotelName - Hotel name to search for
     * @returns Promise<HotelMasterEntity[]> - Array of hotels
     */
    async findHotelsByName(hotelName: string): Promise<HotelMasterEntity[]> {
        try {
            return await this.hotelMasterRepo
                .createQueryBuilder('hotel')
                .where('LOWER(hotel.hotelName) LIKE LOWER(:hotelName)', { hotelName: `%${hotelName}%` })
                .andWhere('hotel.isActive = :isActive', { isActive: true })
                .andWhere('hotel.isDeleted = :isDeleted', { isDeleted: false })
                .andWhere('hotel.providerCode = :providerCode', { providerCode: 'TBO' })
                .getMany();
        } catch (error) {
            console.error('Error finding hotels by name:', error);
            throw new BadRequestException('Failed to find hotels by name');
        }
    }

    /**
     * Find hotels by coordinates within radius
     * @param coordinates - Latitude and longitude
     * @param radiusKm - Search radius in kilometers
     * @returns Promise<HotelMasterEntity[]> - Array of hotels
     */
    async findHotelsByCoordinates(coordinates: { lat: number; lng: number }, radiusKm: number = 50): Promise<HotelMasterEntity[]> {
        const { lat, lng } = coordinates;

        // Validate input coordinates
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new BadRequestException('Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180');
        }

        if (radiusKm <= 0) {
            throw new BadRequestException('Radius must be greater than 0');
        }

        try {
            // Calculate bounding box to pre-filter results (optimization)
            const latRadiusInDegrees = radiusKm / 111; // 1 degree ≈ 111 km
            const latMin = lat - latRadiusInDegrees;
            const latMax = lat + latRadiusInDegrees;

            // Adjust longitude calculation based on latitude (longitude lines converge at poles)
            const lngDegreeLength = 111 * Math.cos((lat * Math.PI) / 180);
            const lngRadiusInDegrees = radiusKm / lngDegreeLength;
            const lngMin = lng - lngRadiusInDegrees;
            const lngMax = lng + lngRadiusInDegrees;

            // Use Haversine formula for accurate distance calculation
            const query = this.hotelMasterRepo
                .createQueryBuilder('hotel')
                .where('hotel.latitude IS NOT NULL AND hotel.longitude IS NOT NULL')
                .andWhere('hotel.latitude BETWEEN :latMin AND :latMax', {
                    latMin,
                    latMax,
                })
                .andWhere('hotel.longitude BETWEEN :lngMin AND :lngMax', {
                    lngMin,
                    lngMax,
                })
                .andWhere('hotel.isActive = :isActive', { isActive: true })
                .andWhere('hotel.isDeleted = :isDeleted', { isDeleted: false })
                .andWhere('hotel.providerCode = :providerCode', { providerCode: 'TBO' })
                .andWhere(
                    `
                    6371 * acos(
                      greatest(-1, least(1,
                        cos(radians(:lat)) * cos(radians(hotel.latitude)) *
                        cos(radians(hotel.longitude) - radians(:lng)) +
                        sin(radians(:lat)) * sin(radians(hotel.latitude))
                      ))
                    ) <= :radius
                    `,
                    { lat, lng, radius: radiusKm },
                )
                .orderBy(
                    `
                    6371 * acos(
                      greatest(-1, least(1,
                        cos(radians(:lat)) * cos(radians(hotel.latitude)) *
                        cos(radians(hotel.longitude) - radians(:lng)) +
                        sin(radians(:lat)) * sin(radians(hotel.latitude))
                      ))
                    )
                    `,
                    'ASC',
                );

            return await query.getMany();
        } catch (error) {
            console.error('Error finding hotels by coordinates:', error);
            throw new BadRequestException('Failed to find hotels by location');
        }
    }
}
