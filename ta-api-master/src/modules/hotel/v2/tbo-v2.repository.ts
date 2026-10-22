import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelMasterEntity } from 'src/shared/entities/hotel-master.entity';
import { TboHotelListEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-list.entity';
import { TboRepository } from '../providers/tbo/tbo.repository';

/**
 * v2 only: same as TboRepository, except hotel-code lookups read tbo_hotel_list
 * (hotel_master holds only a small subset of TBO hotels, so most codes would come back
 * without name / address / star rating). Provided as TboRepository inside HotelV2Module only.
 */
@Injectable()
export class TboV2Repository extends TboRepository {
    constructor(
        @InjectRepository(HotelMasterEntity)
        private readonly v2HotelMasterRepo: Repository<HotelMasterEntity>,
        @InjectRepository(TboHotelListEntity)
        private readonly v2HotelListRepo: Repository<TboHotelListEntity>,
    ) {
        super(v2HotelMasterRepo, v2HotelListRepo);
    }

    async findHotelsByHotelCode(hotelCodes: string[]): Promise<any[]> {
        try {
            if (!hotelCodes || hotelCodes.length === 0) {
                return [];
            }

            const hotels = await this.v2HotelListRepo
                .createQueryBuilder('hotel')
                .where('hotel.tboHotelId IN (:...hotelCodes)', { hotelCodes })
                .getMany();

            if (hotels.length === 0) {
                return [];
            }

            // Same shape as TboRepository location results: tbo_hotel_list + extra details from hotel_master
            const oldHotels = await this.v2HotelMasterRepo
                .createQueryBuilder('hotel')
                .where('hotel.hotelCode IN (:...hotelCodes)', { hotelCodes: hotels.map((h) => h.tboHotelId) })
                .andWhere('hotel.providerCode = :providerCode', { providerCode: 'TBO' })
                .getMany();
            const oldHotelMap = new Map(oldHotels.map((h) => [h.hotelCode, h]));

            return hotels.map((h) => {
                const old = oldHotelMap.get(h.tboHotelId);
                return {
                    hotelCode: h.tboHotelId,
                    hotelName: h.hotelName,
                    address: [h.addressLine1, h.addressLine2].filter(Boolean).join(', '),
                    city: h.cityName,
                    country: h.countryName,
                    countryCode: h.countryCode,
                    latitude: h.latitude,
                    longitude: h.longitude,
                    starRating: h.starRating,
                    state: old?.state || '',
                    postalCode: old?.postalCode || '',
                    heroImage: old?.heroImage || '',
                };
            });
        } catch (error) {
            console.error('Error finding hotels by hotel code (v2):', error);
            throw new BadRequestException('Failed to find hotels by hotel code');
        }
    }
}
