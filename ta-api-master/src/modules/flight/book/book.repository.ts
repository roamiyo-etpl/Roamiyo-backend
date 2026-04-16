import { Injectable } from '@nestjs/common';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { Booking, BookingFrom, BookingStatus, JourneyType, paxesData } from 'src/shared/entities/bookings.entity';
import { BookDto, Passenger } from './dtos/book.dto';
import { PassengerType } from 'src/shared/enums/flight/flight.enum';
import { BookingLog, PaymentStatus } from 'src/shared/entities/booking-logs.entity';
import { BookResponse, Order } from './interfaces/book.interface';
import { BookingAdditionalDetail, AddBookingType } from 'src/shared/entities/booking-additional-details.entity';
import { OrderDetailResponse } from '../order-details/interfaces/order-detail.interface';
import { FareRules } from '../revalidate/interfaces/revalidate.interface';
import { DuplicateBookingException } from './exceptions/duplicate-booking.exception';
import { v4 as uuid } from 'uuid';
import { Generic } from 'src/shared/utilities/flight/generic.utility';

@Injectable()
export class BookRepository extends Repository<Booking> {
    constructor(private readonly dataSource: DataSource) {
        super(Booking, dataSource.createEntityManager());
    }

    /**
     * Check for duplicate booking request
     * Prevents multiple bookings with same details when status is PENDING or INPROGRESS
     */
    async checkDuplicateBooking(reqParams): Promise<Booking | null> {
        const { booking, userId } = reqParams;
        // Extract route details - routes is now RouteDetails[][]
        // For multi-city: each route in the array represents a leg of the journey
        const firstLeg = booking.routes[0];
        const lastLeg = booking.routes[booking.routes.length - 1];

        const firstSegment = firstLeg[0];
        const lastSegment = lastLeg[lastLeg.length - 1];

        // Calculate passenger counts
        const adultCount = booking.passengers.filter((p) => p.passengerType === PassengerType.ADULT).length;
        const childCount = booking.passengers.filter((p) => p.passengerType === PassengerType.CHILD).length;
        const infantCount = booking.passengers.filter((p) => p.passengerType === PassengerType.INFANT).length;

        console.log(firstSegment.departureDate);
        // Search for existing bookings with same criteria
        const existingBooking = await this.createQueryBuilder('booking')
            .where('booking.user_id = :userId', { userId })
            .andWhere('booking.origin_code @> ARRAY[:origin]::text[]', { origin: firstSegment.departureCode })
            .andWhere('booking.destination_code @> ARRAY[:destination]::text[]', { destination: lastSegment.arrivalCode })
            .andWhere('DATE(booking.checkin) = DATE(:checkin)', { checkin: new Date(firstSegment.departureDate) })
            .andWhere('DATE(booking.checkout) = DATE(:checkout)', { checkout: new Date(lastSegment.arrivalDate) })
            .andWhere('booking.supplier_name = :supplier', { supplier: booking.providerCode })
            .andWhere('booking.booking_status IN (:...statuses)', {
                statuses: [BookingStatus.PENDING, BookingStatus.INPROGRESS],
            })
            .andWhere('booking.journey_type = :journeyType', { journeyType: booking.airTripType })
            // Check passenger count matches
            .andWhere("(booking.paxes->0->'adult'->>'count')::int = :adultCount", { adultCount })
            .andWhere("(booking.paxes->0->'child'->>'count')::int = :childCount", { childCount })
            .andWhere("(booking.paxes->0->'infant'->>'count')::int = :infantCount", { infantCount })
            .orderBy('booking.created_at', 'DESC')
            .getOne();

        return existingBooking;
    }

    /** [@Description: This method is used to initiate the booking]
     * @author: Prashant Joshi at 13-10-2025 **/
    async insertBooking(reqParams): Promise<Booking> {
        const { booking, userId, mwrLogId, currency } = reqParams;

        const bookingEntity = new Booking();

        bookingEntity.supplier_name = booking.providerCode;
        bookingEntity.booking_date = new Date();
        bookingEntity.booking_status = BookingStatus.INPROGRESS;
        bookingEntity.journey_type = booking.airTripType as any;

        bookingEntity.contact_details = {
            title: booking.contact.title,
            firstName: booking.contact.firstName,
            middleName: booking.contact.middleName || '',
            lastName: booking.contact.lastName,
            gender: booking.contact.gender,
            email: booking.contact.email,
            dialCode: booking.contact.mobileCountryCode,
            mobileNo: booking.contact.mobile,
        };

        const originCodes: string[] = [];
        const destinationCodes: string[] = [];

        booking.routes.forEach((leg) => {
            if (leg && leg.length > 0) {
                originCodes.push(leg[0].departureCode);
                destinationCodes.push(leg[leg.length - 1].arrivalCode);
            }
        });

        bookingEntity.origin_code = originCodes;
        bookingEntity.destination_code = destinationCodes;

        const firstLeg = booking.routes[0];
        const lastLeg = booking.routes[booking.routes.length - 1];

        if (firstLeg && firstLeg.length > 0) {
            bookingEntity.checkin = new Date(firstLeg[0].departureDate);
        }

        if (lastLeg && lastLeg.length > 0) {
            const lastSegment = lastLeg[lastLeg.length - 1];
            bookingEntity.checkout = new Date(lastSegment.arrivalDate);
        }

        bookingEntity.paxes = this.mapPassengersToPaxes(booking.passengers, booking.contact.email);

        bookingEntity.user_id = userId;
        bookingEntity.legacy_booking_id = 0;
        bookingEntity.module_type = 1;
        bookingEntity.mwr_log_id = mwrLogId;
        bookingEntity.booking_reference_id = `TA-${Generic.generateRandomString()}`;
        bookingEntity.search_id = booking.searchReqId;

        return this.save(bookingEntity);
    }

    /** [@Description: This method is used to get the booking by booking id]
     * @author: Prashant Joshi at 13-10-2025 **/
    async getBookingByBookingId(reqParams): Promise<Booking> {
        const { bookingId } = reqParams;
        const booking = await this.findOne({ where: { booking_id: bookingId } });
        if (!booking) {
            throw new Error('Booking not found');
        }
        return booking;
    }

    /** [@Description: This method is used to store the booking log]
     * @author: Prashant Joshi at 13-10-2025 **/
    async storeBookingLog(reqParams): Promise<BookingLog> {
        const { bookingRefId, userId, mwrLogId } = reqParams;

        /* create booking log */
        const bookingLog = new BookingLog();
        bookingLog.log_id = mwrLogId;
        bookingLog.booking_reference_id = bookingRefId;
        bookingLog.user_id = userId;
        bookingLog.data = {};
        bookingLog.is_verified = false;
        bookingLog.payment_status = PaymentStatus.PENDING;
        bookingLog.transaction_id = null;
        bookingLog.created_at = new Date();
        bookingLog.updated_at = new Date();
        return this.dataSource.getRepository(BookingLog).save(bookingLog);
    }

    /** [@Description: This method is used to get the booking log by booking log id]
     * @author: Prashant Joshi at 13-10-2025 **/
    async getBookingLogByBookingLogId(reqParams): Promise<BookingLog> {
        const { bookingLogId } = reqParams;
        // Validate bookingLogId
        if (!bookingLogId) {
            throw new Error('Booking log ID is required');
        }

        // Parse to integer and validate
        const logId = bookingLogId;

        const THIRTY_MINUTES = 30 * 60 * 1000; // 30 min in ms
        const thirtyMinAgo = new Date(Date.now() - THIRTY_MINUTES);

        const bookingLog = await this.dataSource.getRepository(BookingLog).findOne({
            where: {
                log_id: logId,
                is_verified: false,
                created_at: MoreThanOrEqual(thirtyMinAgo),
            },
        });
        if (!bookingLog) {
            throw new Error(`Booking log not found with ID: ${logId}`);
        }
        return bookingLog;
    }

    /** [@Description: This method is used to update the booking log data]
     * @author: Prashant Joshi at 13-10-2025 **/
    async updateBookingLogData(reqParams): Promise<BookingLog> {
        const { bookingLogId, data } = reqParams;
        const bookingLog = await this.dataSource.getRepository(BookingLog).findOne({ where: { id: bookingLogId } });
        if (!bookingLog) {
            throw new Error('Booking log not found');
        }
        bookingLog.data = data;
        return this.dataSource.getRepository(BookingLog).save(bookingLog);
    }

    async updateBookingWithSupplierDetails(reqParams): Promise<Booking> {
        const { bookingId, supplierDetails, bookingData, supplierResponse, bookingItem = 1 } = reqParams;
        const booking = await this.findOne({ where: { booking_id: bookingId } });
        if (!booking) {
            throw new Error('Booking not found');
        }

        const orderDetails = supplierDetails.orderDetails;
        const orderDetail = supplierDetails.orderDetail;
        const isRoundTrip = Array.isArray(orderDetails) && orderDetails.length > 1;

        if (isRoundTrip) {
            this.mapRoundTripOrderDetails(booking, orderDetails);
        } else if (orderDetails && !orderDetails.error) {
            const singleOrderDetail = Array.isArray(orderDetails) ? orderDetails[0] : orderDetails;
            this.mapSingleTripOrderDetails(booking, singleOrderDetail);
        }

        if (orderDetail && Array.isArray(orderDetail) && orderDetail.length > 0) {
            this.mapOrderDetailData(booking, orderDetail);
        }

        this.mapBasicBookingFields(booking);
        booking.updated_at = new Date();

        const savedBooking = await this.save(booking);

        if (bookingData && supplierResponse) {
            try {
                await this.createBookingAdditionalDetail({
                    bookingId,
                    bookingReferenceId: savedBooking.booking_reference_id,
                    supplierResponse,
                    bookingData,
                    orderDetails: isRoundTrip ? orderDetails : Array.isArray(orderDetails) ? orderDetails : [orderDetails],
                    bookingItem,
                });
            } catch (error) {
                console.error('Error creating booking additional details:', error);
            }
        }

        return savedBooking;
    }

    private mapRoundTripOrderDetails(booking: Booking, orderDetailsArray: any[]): void {
        const confirmedOrders = orderDetailsArray.filter(
            (orderDetail) => orderDetail?.bookingStatus?.toLowerCase() === 'confirmed' || orderDetail?.bookingStatus === BookingStatus.CONFIRMED || orderDetail?.bookingStatus === 'CONFIRMED',
        );

        const ordersToProcess = confirmedOrders.length > 0 ? confirmedOrders : orderDetailsArray;

        const supplierRefs: string[] = [];
        const bookingRefs: string[] = [];

        let totalFare = 0;
        let totalPublicPrice = 0;
        let totalNetPrice = 0;
        let totalTax = 0;
        let currency = '';

        for (const orderDetail of ordersToProcess) {
            if (!orderDetail || orderDetail.error) continue;

            if (orderDetail.bookingId) {
                supplierRefs.push(orderDetail.bookingId.toString());
            }

            if (orderDetail.bookingRefNumber) {
                bookingRefs.push(orderDetail.bookingRefNumber);
            } else if (orderDetail.pnr) {
                bookingRefs.push(orderDetail.pnr);
            }

            if (orderDetail.bookingStatus) {
                const mappedStatus = this.mapBookingStatus(orderDetail.bookingStatus);
                if (mappedStatus === BookingStatus.CONFIRMED) {
                    booking.booking_status = BookingStatus.PENDING; // TBO will confirm the booking later
                } else if (booking.booking_status !== BookingStatus.CONFIRMED) {
                    booking.booking_status = mappedStatus || BookingStatus.PENDING;
                }
            }

            if (orderDetail.routes?.fare && orderDetail.routes.fare.length > 0) {
                const fare = orderDetail.routes.fare[0];

                if (fare.bsPublish !== undefined) {
                    totalPublicPrice += parseFloat(fare.bsPublish.toString()) || 0;
                }

                if (fare.bsFare !== undefined) {
                    totalNetPrice += parseFloat(fare.bsFare.toString()) || 0;
                }

                if (fare.bsPublish !== undefined) {
                    totalFare += parseFloat(fare.bsPublish.toString()) || 0;
                } else {
                    const currentBsFare = fare.bsFare ? parseFloat(fare.bsFare.toString()) : 0;
                    const currentTax = fare.tax ? parseFloat(fare.tax.toString()) : fare.bsTax ? parseFloat(fare.bsTax.toString()) : 0;

                    if (currentBsFare > 0 && currentTax > 0) {
                        totalFare += currentBsFare + currentTax;
                    } else if (fare.totalFare) {
                        totalFare += parseFloat(fare.totalFare.toString()) || 0;
                    }
                }
                if (fare.sellingPrice && !fare.bsPublish) {
                    totalPublicPrice += parseFloat(fare.sellingPrice.toString()) || 0;
                }
                if (fare.baseFare && !fare.bsFare) {
                    totalNetPrice += parseFloat(fare.baseFare.toString()) || 0;
                }

                if (fare.tax) {
                    totalTax += parseFloat(fare.tax.toString()) || 0;
                } else if (fare.bsTax) {
                    totalTax += parseFloat(fare.bsTax.toString()) || 0;
                }

                if (fare.currency && !currency) {
                    currency = fare.currency;
                }
            }

            if (orderDetail.routes?.isRefundable) {
                booking.is_refundable = true;
            }
        }

        if (totalFare > 0) {
            booking.total = totalFare;
        }
        if (totalPublicPrice > 0) {
            booking.public_price = totalPublicPrice;
        }
        if (totalNetPrice > 0) {
            booking.net_price = totalNetPrice;
        }
        if (totalTax > 0) {
            booking.tax = totalTax;
        }
        if (currency) {
            booking.currency_code = currency;
        }

        if (totalPublicPrice > 0 && totalFare > 0 && totalPublicPrice > totalFare) {
            booking.savings_amount = totalPublicPrice - totalFare;
            booking.savings_percentage = ((booking.savings_amount / totalPublicPrice) * 100).toFixed(2) as any;
        }

        if (supplierRefs.length > 0) {
            booking.supplier_reference_id = supplierRefs.join(',');
        }

        if (orderDetailsArray.length > 0) {
            this.mapRoundTripLocationDetails(booking, orderDetailsArray);
        }
    }

    private mapSingleTripOrderDetails(booking: Booking, orderDetails: any): void {
        if (!orderDetails || orderDetails.error) return;

        if (orderDetails.bookingId) {
            booking.supplier_reference_id = orderDetails.bookingId.toString();
        }

        if (orderDetails.bookingStatus) {
            const mappedStatus = this.mapBookingStatus(orderDetails.bookingStatus);
            if (mappedStatus !== undefined) {
                booking.booking_status = mappedStatus;
            }
        }

        if (orderDetails.routes?.fare && orderDetails.routes.fare.length > 0) {
            const fare = orderDetails.routes.fare[0];

            if (fare.bsPublish !== undefined) {
                booking.public_price = parseFloat(fare.bsPublish.toString()) || 0;
            }

            if (fare.bsFare !== undefined) {
                booking.net_price = parseFloat(fare.bsFare.toString()) || 0;
            }

            if (fare.bsPublish !== undefined) {
                booking.total = parseFloat(fare.bsPublish.toString()) || 0;
            } else {
                const bsFare = fare.bsFare ? parseFloat(fare.bsFare.toString()) : 0;
                const tax = fare.tax ? parseFloat(fare.tax.toString()) : fare.bsTax ? parseFloat(fare.bsTax.toString()) : 0;

                if (bsFare > 0 && tax > 0) {
                    booking.total = bsFare + tax;
                } else if (fare.totalFare) {
                    booking.total = parseFloat(fare.totalFare.toString()) || 0;
                }
            }
            if (fare.sellingPrice && !fare.bsPublish) {
                booking.public_price = parseFloat(fare.sellingPrice.toString()) || 0;
            }
            if (fare.baseFare && !fare.bsFare) {
                booking.net_price = parseFloat(fare.baseFare.toString()) || 0;
            }

            if (fare.tax) {
                booking.tax = parseFloat(fare.tax.toString()) || 0;
            } else if (fare.bsTax) {
                booking.tax = parseFloat(fare.bsTax.toString()) || 0;
            }

            if (fare.currency) {
                booking.currency_code = fare.currency;
            }

            const publicPrice = booking.public_price || 0;
            const totalPrice = booking.total || 0;
            if (publicPrice > 0 && totalPrice > 0 && publicPrice > totalPrice) {
                booking.savings_amount = publicPrice - totalPrice;
                booking.savings_percentage = ((booking.savings_amount / publicPrice) * 100).toFixed(2) as any;
            }
        }

        if (orderDetails.routes?.isRefundable !== undefined) {
            booking.is_refundable = orderDetails.routes.isRefundable;
        }

        this.mapLocationDetails(booking, orderDetails, orderDetails);
    }

    private mapRoundTripLocationDetails(booking: Booking, orderDetailsArray: any[]): void {
        const originCodes: string[] = [];
        const destinationCodes: string[] = [];
        const originCities: string[] = [];
        const destinationCities: string[] = [];
        const originCountries: string[] = [];
        const destinationCountries: string[] = [];

        for (const orderDetail of orderDetailsArray) {
            if (!orderDetail?.routes?.flightSegments || orderDetail.routes.flightSegments.length === 0) continue;

            const segments = orderDetail.routes.flightSegments;
            const firstSegment = segments[0];
            const lastSegment = segments[segments.length - 1];

            if (firstSegment.departure && firstSegment.departure.length > 0) {
                const departureInfo = firstSegment.departure[0];
                originCodes.push(departureInfo.code);
                originCities.push(departureInfo.city || '');
                originCountries.push(departureInfo.country || '');
            }

            if (lastSegment.arrival && lastSegment.arrival.length > 0) {
                const arrivalInfo = lastSegment.arrival[0];
                destinationCodes.push(arrivalInfo.code);
                destinationCities.push(arrivalInfo.city || '');
                destinationCountries.push(arrivalInfo.country || '');
            }
        }

        if (originCodes.length > 0) {
            booking.origin_code = originCodes;
            booking.origin_city = originCities;
            booking.origin_country = originCountries;
        }
        if (destinationCodes.length > 0) {
            booking.destination_code = destinationCodes;
            booking.destination_city = destinationCities;
            booking.destination_country = destinationCountries;
        }
    }

    private mapLocationDetails(booking: Booking, firstOrder: any, lastOrder: any): void {
        const originCodes: string[] = [];
        const destinationCodes: string[] = [];
        const originCities: string[] = [];
        const destinationCities: string[] = [];
        const originCountries: string[] = [];
        const destinationCountries: string[] = [];

        // Check if this is a multi-city booking with departureInfo and arrivalInfo arrays
        // These arrays contain all departure and arrival points for multi-city journeys
        const routes = firstOrder?.routes || lastOrder?.routes;

        if (routes?.departureInfo && Array.isArray(routes.departureInfo) && routes.departureInfo.length > 0) {
            // Multi-city: Extract all departure points from departureInfo array
            routes.departureInfo.forEach((departure: any) => {
                if (departure?.code) {
                    originCodes.push(departure.code);
                    originCities.push(departure.city || '');
                    originCountries.push(departure.country || '');
                }
            });
        }

        if (routes?.arrivalInfo && Array.isArray(routes.arrivalInfo) && routes.arrivalInfo.length > 0) {
            // Multi-city: Extract all arrival points from arrivalInfo array
            routes.arrivalInfo.forEach((arrival: any) => {
                if (arrival?.code) {
                    destinationCodes.push(arrival.code);
                    destinationCities.push(arrival.city || '');
                    destinationCountries.push(arrival.country || '');
                }
            });
        }

        // Fallback: If departureInfo/arrivalInfo arrays are not available,
        // extract from first and last flight segments (for single trip or round trip)
        if (originCodes.length === 0 && firstOrder?.routes?.flightSegments && firstOrder.routes.flightSegments.length > 0) {
            const firstSegment = firstOrder.routes.flightSegments[0];
            if (firstSegment.departure && firstSegment.departure.length > 0) {
                const departureInfo = firstSegment.departure[0];
                originCodes.push(departureInfo.code);
                originCities.push(departureInfo.city || '');
                originCountries.push(departureInfo.country || '');
            }
        }

        if (destinationCodes.length === 0 && lastOrder?.routes?.flightSegments && lastOrder.routes.flightSegments.length > 0) {
            const segments = lastOrder.routes.flightSegments;
            const lastSegment = segments[segments.length - 1];
            if (lastSegment.arrival && lastSegment.arrival.length > 0) {
                const arrivalInfo = lastSegment.arrival[0];
                destinationCodes.push(arrivalInfo.code);
                destinationCities.push(arrivalInfo.city || '');
                destinationCountries.push(arrivalInfo.country || '');
            }
        }

        if (originCodes.length > 0) {
            booking.origin_code = originCodes;
            booking.origin_city = originCities;
            booking.origin_country = originCountries;
        }
        if (destinationCodes.length > 0) {
            booking.destination_code = destinationCodes;
            booking.destination_city = destinationCities;
            booking.destination_country = destinationCountries;
        }
    }

    private mapBookingStatus(status: string): BookingStatus | undefined {
        const statusMap: Record<string, BookingStatus> = {
            confirmed: BookingStatus.CONFIRMED,
            booked: BookingStatus.BOOKED,
            pending: BookingStatus.PENDING,
            cancelled: BookingStatus.CANCELLED,
            failed: BookingStatus.FAILED,
        };
        return statusMap[status?.toLowerCase()];
    }

    private mapOrderDetailData(booking: Booking, orderDetail: any[]): void {
        const orderNos = orderDetail.map((order) => order.orderNo).filter(Boolean);
        if (orderNos.length > 0) {
            booking.supplier_reference_id = orderNos.join(',');
        }

        const hasPriceChange = orderDetail.some((order) => order.isPriceChanged);
        const hasScheduleChange = orderDetail.some((order) => order.isScheduleChanged);

        if (hasPriceChange || hasScheduleChange) {
            console.warn('Price or schedule changed for booking:', booking.booking_id);
        }

        if (!booking.total && orderDetail.length > 0) {
            const firstOrder = orderDetail[0];
            if (firstOrder.orderAmount) {
                booking.total = firstOrder.orderAmount;
                booking.public_price = firstOrder.orderAmount;
            }
            if (firstOrder.currency) {
                booking.currency_code = firstOrder.currency;
            }
            if (firstOrder.supplierBaseAmount) {
                booking.net_price = parseFloat(firstOrder.supplierBaseAmount) || 0;
            }
        }
    }

    private mapBasicBookingFields(booking: Booking): void {
        booking.module_type = 1; // Flight
        booking.booking_from = BookingFrom.WEB;
        booking.is_verified = false;
    }

    /** [@Description: This method is used to extract the passport data from the passengers]
     * Helper method: Extract passport data from passengers
     * Formats passport information for storage in additional details
     * @author: Prashant Joshi at 13-10-2025 **/
    private extractPassportData(passengers: Passenger[]): any {
        const passengersWithPassport = passengers.filter((p) => p.document);

        if (passengersWithPassport.length === 0) {
            return null;
        }

        return {
            passengers: passengersWithPassport.map((p) => ({
                passengerName: `${p.passengerDetail.firstName} ${p.passengerDetail.lastName}`,
                passengerType: p.passengerType,
                documentType: p.document?.documentType,
                documentNumber: p.document?.documentNumber,
                documentExpiryDate: p.document?.expiryDate,
                passportIssuingCountry: p.document?.country,
                nationality: p.nationality,
            })),
        };
    }

    /** [@Description: This method is used to extract the cancellation policy from the fare rules]
     * Helper method: Extract and format cancellation policy from fare rules
     * Converts fare rules into readable cancellation policy text
     * @author: Prashant Joshi at 13-10-2025 **/
    private extractCancellationPolicy(fareRules?: FareRules[]): string | null {
        if (!fareRules || fareRules.length === 0) {
            return null;
        }

        const policyText = fareRules
            .map((rule) => {
                const sections: string[] = [];

                if (rule.origin) {
                    sections.push(`Origin: ${rule.origin}`);
                }
                if (rule.Destination) {
                    sections.push(`Destination: ${rule.Destination}`);
                }
                if (rule.Airline) {
                    sections.push(`Airline: ${rule.Airline}`);
                }
                if (rule.FlightNumber) {
                    sections.push(`Flight Number: ${rule.FlightNumber}`);
                }
                if (rule.DepartureDate) {
                    sections.push(`Departure Date: ${rule.DepartureDate}`);
                }
                if (rule.FareBasisCode) {
                    sections.push(`Fare Basis Code: ${rule.FareBasisCode}`);
                }
                if (rule.FareRestriction) {
                    sections.push(`Fare Restriction: ${rule.FareRestriction}`);
                }
                if (rule.FareRuleDetail) {
                    sections.push(`\nFare Rule Details:\n${rule.FareRuleDetail}`);
                }

                return sections.join('\n');
            })
            .join('\n\n---\n\n');

        return policyText;
    }

    /** [@Description: This method is used to create the booking additional detail]
     * Create booking additional details entry
     * Stores supplier and API request/response data separately for audit trail
     * @author: Prashant Joshi at 13-10-2025 **/
    async createBookingAdditionalDetail(reqParams): Promise<BookingAdditionalDetail> {
        const { bookingId, bookingReferenceId, supplierResponse, bookingData, orderDetails, bookingItem = 1 } = reqParams;

        // Check if a record with the same booking_id already exists
        const existingDetail = await this.dataSource.getRepository(BookingAdditionalDetail).findOne({
            where: { booking_id: bookingId },
        });

        let additionalDetail: BookingAdditionalDetail;

        if (existingDetail) {
            // Update existing record
            additionalDetail = existingDetail;
        } else {
            // Create new record
            additionalDetail = new BookingAdditionalDetail();
            // Set created_at only for new records
            additionalDetail.created_at = new Date();
        }

        // Required fields
        additionalDetail.booking_id = bookingId;
        additionalDetail.booking_reference_id = bookingReferenceId;
        additionalDetail.booking_item = bookingItem;

        // Set booking type
        additionalDetail.add_booking_type = AddBookingType.DEFAULT_BOOKING;

        // 1. Supplier Response: Store ONLY raw supplier response (from TBO, Amadeus, etc.)
        //    This is the actual response received from the provider's API
        additionalDetail.supplier_response = supplierResponse;

        // 2. API Response: Store ONLY our API request/response
        //    Request: What client sent to our API
        //    Response: What our API returned to client (processed BookResponse)
        //    Do not store raw supplier response
        additionalDetail.api_response = {
            booking: {
                request: bookingData.request, // Client's booking request to our API
                response: bookingData.response, // Our processed response returned to client
            },
            orderDetails,
        };

        // 3. Store cancellation policy from fare rules
        if (orderDetails?.routes?.fareRules) {
            const cancellationPolicy = this.extractCancellationPolicy(orderDetails.routes.fareRules);
            if (cancellationPolicy) {
                additionalDetail.terms_cancellation_policy = cancellationPolicy;
            }
        }

        // 4. Store passport data for international flights
        if (bookingData.request.passengers && bookingData.request.passengers.length > 0) {
            const passportData = this.extractPassportData(bookingData.request.passengers);
            if (passportData) {
                additionalDetail.passport_document_data = passportData;
            }
        }

        // 5. Store GST details if provided
        if (bookingData.request.gst) {
            additionalDetail.gst_details = {
                gstCompanyAddress: bookingData.request.gst.gstCompanyAddress,
                gstCompanyContactNumber: bookingData.request.gst.gstCompanyContactNumber,
                gstCompanyName: bookingData.request.gst.gstCompanyName,
                gstNumber: bookingData.request.gst.gstNumber,
                gstCompanyEmail: bookingData.request.gst.gstCompanyEmail,
            };
        }

        // Update timestamp (always update, regardless of create or update)
        additionalDetail.updated_at = new Date();

        // Save and return (will update if exists, create if new)
        return this.dataSource.getRepository(BookingAdditionalDetail).save(additionalDetail);
    }

    /** [@Description: This method is used to verify the booking log]
     * @author: Prashant Joshi at 13-10-2025 **/
    async verifyBookingLog(reqParams): Promise<BookingLog> {
        const { bookingLogId } = reqParams;
        // Validate bookingLogId
        if (!bookingLogId) {
            throw new Error('Booking log ID is required');
        }

        const bookingLog = await this.dataSource.getRepository(BookingLog).findOne({ where: { log_id: bookingLogId } });
        if (!bookingLog) {
            throw new Error(`Booking log not found with ID: ${bookingLogId}`);
        }
        bookingLog.is_verified = true;
        bookingLog.payment_status = PaymentStatus.CAPTURED;
        bookingLog.transaction_id = uuid();
        bookingLog.updated_at = new Date();
        return this.dataSource.getRepository(BookingLog).save(bookingLog);
    }

    /** [@Description: Maps passengers to paxes format for booking entity]
     * @author: Prashant Joshi at  29-10-2025 **/
    private mapPassengersToPaxes(passengers: Passenger[], contactEmail: string) {
        // Filter passengers by type
        const adultPassengers = passengers.filter((p) => p.passengerType === PassengerType.ADULT);
        const childPassengers = passengers.filter((p) => p.passengerType === PassengerType.CHILD);
        const infantPassengers = passengers.filter((p) => p.passengerType === PassengerType.INFANT);

        // Get passenger counts
        const adultCount = adultPassengers.length;
        const childCount = childPassengers.length;
        const infantCount = infantPassengers.length;

        // Map detailed passenger data for each type
        const adultData: paxesData[] = adultPassengers.map((p) => ({
            age: Generic.calculateAge(p.dateOfBirth),
            dob: p.dateOfBirth,
            firstName: p.passengerDetail.firstName,
            middleName: p.passengerDetail.middleName,
            lastName: p.passengerDetail.lastName,
            title: p.passengerDetail.title,
            nationality: p.nationality,
            email: contactEmail,
            passport: p.document?.documentNumber,
            passportIssueDate: p.document?.expiryDate,
            passportExpDate: p.document?.expiryDate,
        }));

        const childData: paxesData[] = childPassengers.map((p) => ({
            age: Generic.calculateAge(p.dateOfBirth),
            dob: p.dateOfBirth,
            firstName: p.passengerDetail.firstName,
            middleName: p.passengerDetail.middleName,
            lastName: p.passengerDetail.lastName,
            title: p.passengerDetail.title,
            nationality: p.nationality,
            email: contactEmail,
            passport: p.document?.documentNumber,
            passportIssueDate: p.document?.expiryDate,
            passportExpDate: p.document?.expiryDate,
        }));

        const infantData: paxesData[] = infantPassengers.map((p) => ({
            age: Generic.calculateAge(p.dateOfBirth),
            dob: p.dateOfBirth,
            firstName: p.passengerDetail.firstName,
            middleName: p.passengerDetail.middleName,
            lastName: p.passengerDetail.lastName,
            title: p.passengerDetail.title,
            nationality: p.nationality,
            email: contactEmail,
            passport: p.document?.documentNumber,
            passportIssueDate: p.document?.expiryDate,
            passportExpDate: p.document?.expiryDate,
        }));

        // Return paxes format array
        return [
            {
                adult: {
                    count: adultCount,
                    data: adultData,
                },
                child: {
                    count: childCount,
                    data: childData,
                },
                infant: {
                    count: infantCount,
                    data: infantData,
                },
            },
        ];
    }

    async BookingStatusFailed(reqParams): Promise<Booking> {
        const { bookingId } = reqParams;
        const booking = await this.findOne({ where: { booking_id: bookingId } });
        if (!booking) {
            throw new Error('Booking not found');
        }
        booking.booking_status = BookingStatus.FAILED;
        return this.save(booking);
    }
}
