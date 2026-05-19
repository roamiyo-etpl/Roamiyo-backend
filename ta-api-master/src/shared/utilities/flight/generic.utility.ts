import moment from 'moment';
import * as zlib from 'zlib';
import md5 from 'md5';
import * as fs from 'fs';
import * as path from 'path';
import { join } from 'path';
import { StartRoutingDto } from 'src/modules/flight/search/dtos/start-routing.dto';
import { CurrencyConversionEntity } from 'src/shared/entities/currency-rate.entity';
import CryptoJS from 'crypto-js';
import { Pagination } from 'src/modules/hotel/search/interfaces/initiate-result-response.interface';
const cryptoSecretKey = '13jHg1P5ks16QW9Q1B2u12F12ADxo';

interface AirlineData {
    airline_name: string;
    airline_code: string;
    selling_price: number;
    count?: number; // added later in reduce
}

export class Generic {
    /** [@Description: Getting minimum price flight]
     * @author: Prashant Joshi at 23-09-2025 **/
    static getMinPriceFlight(routes, priceType) {
        return Math.min.apply(
            null,
            routes.map((item) => item[priceType]),
        );
    }

    /** [@Description: Getting maximum price flight]
     * @author: Prashant Joshi at 23-09-2025 **/
    static getMaxPriceFLight(routes, priceType) {
        return Math.max.apply(
            null,
            routes.map((item) => item[priceType]),
        );
    }

    /** [@Description: Getting stop counts]
     * @author: Prashant Joshi at 23-09-2025 **/
    static getStopCounts(routes, type) {
        const stopsData = {
            non_stop: {
                count: 0,
                min_price: null,
            },
            one_stop: {
                count: 0,
                min_price: null,
            },
            two_and_two_plus_stop: {
                count: 0,
                min_price: null,
            },
        };
        routes.forEach((route) => {
            if (route[type] == 0) {
                if (stopsData.non_stop.min_price == null || stopsData.non_stop.min_price > route.discounted_selling_price) {
                    stopsData.non_stop.min_price = route.discounted_selling_price;
                }
                stopsData.non_stop.count += 1;
            }

            if (route[type] == 1) {
                if (stopsData.one_stop.min_price == null || stopsData.one_stop.min_price > route.discounted_selling_price) {
                    stopsData.one_stop.min_price = route.discounted_selling_price;
                }
                stopsData.one_stop.count += 1;
            }

            if (route[type] > 1) {
                if (stopsData.two_and_two_plus_stop.min_price == null || stopsData.two_and_two_plus_stop.min_price > route.discounted_selling_price) {
                    stopsData.two_and_two_plus_stop.min_price = route.discounted_selling_price;
                }
                stopsData.two_and_two_plus_stop.count += 1;
            }
        });
        return stopsData;
    }

    /** [@Description: Getting airline counts]
     * @author: Prashant Joshi at 23-09-2025 **/
    static getAirlineCounts(routes: any[]): AirlineData[] {
        const airlineList: AirlineData[] = [];

        routes.forEach((route) => {
            const airlineData: AirlineData = {
                airline_name: route.airline_name,
                airline_code: route.airline,
                selling_price: route.discounted_selling_price,
            };
            airlineList.push(airlineData);
        });

        const result: AirlineData[] = [
            ...airlineList
                .reduce((mp, o) => {
                    if (!mp.has(o.airline_code)) {
                        mp.set(o.airline_code, { ...o, count: 0 });
                    }
                    mp.get(o.airline_code)!.count!++;
                    return mp;
                }, new Map<string, AirlineData>())
                .values(),
        ];

        return result;
    }

    /** [@Description: Getting arrival departure time slot]
     * @author: Prashant Joshi at 23-09-2025 **/
    static getArrivalDepartureTimeSlot(routes, type, routeType) {
        const timeSlots = {
            first_slot: {
                min_price: 0,
                count: 0,
                from_time: '00:00 am',
                to_time: '05:59 am',
            },
            second_slot: {
                min_price: 0,
                count: 0,
                from_time: '06:00 am',
                to_time: '11:59 am',
            },
            third_slot: {
                min_price: 0,
                count: 0,
                from_time: '12:00 pm',
                to_time: '05:59 pm',
            },
            fourth_slot: {
                min_price: 0,
                count: 0,
                from_time: '06:00 pm',
                to_time: '11:59 pm',
            },
        };
        let sourceDate;
        routes.forEach((route) => {
            if (type == 'departure_time') {
                sourceDate = moment(route.routes[routeType].stops[0][type], 'HH:mm:a');
            } else {
                sourceDate = moment(route.routes[routeType].stops[route.routes[routeType].stops.length - 1][type], 'HH:mm:a');
            }
            if (sourceDate.isBetween(moment(timeSlots.first_slot.from_time, 'HH:mm:a'), moment(timeSlots.first_slot.to_time, 'HH:mm:a'))) {
                timeSlots.first_slot.count += 1;
                if (
                    timeSlots.first_slot.min_price == 0 ||
                    // timeSlots.first_slot.min_price > route.selling_price
                    timeSlots.first_slot.min_price > route.discounted_selling_price
                ) {
                    // timeSlots.first_slot.min_price = route.selling_price;
                    timeSlots.first_slot.min_price = route.discounted_selling_price;
                }
            }

            if (sourceDate.isBetween(moment(timeSlots.second_slot.from_time, 'HH:mm:a'), moment(timeSlots.second_slot.to_time, 'HH:mm:a'))) {
                timeSlots.second_slot.count += 1;
                if (
                    timeSlots.second_slot.min_price == 0 ||
                    // timeSlots.second_slot.min_price > route.selling_price
                    timeSlots.second_slot.min_price > route.discounted_selling_price
                ) {
                    // timeSlots.second_slot.min_price = route.selling_price;
                    timeSlots.second_slot.min_price = route.discounted_selling_price;
                }
            }

            if (sourceDate.isBetween(moment(timeSlots.third_slot.from_time, 'HH:mm:a'), moment(timeSlots.third_slot.to_time, 'HH:mm:a'))) {
                timeSlots.third_slot.count += 1;
                if (
                    timeSlots.third_slot.min_price == 0 ||
                    // timeSlots.third_slot.min_price > route.selling_price
                    timeSlots.third_slot.min_price > route.discounted_selling_price
                ) {
                    // timeSlots.third_slot.min_price = route.selling_price;
                    timeSlots.third_slot.min_price = route.discounted_selling_price;
                }
            }

            if (sourceDate.isBetween(moment(timeSlots.fourth_slot.from_time, 'HH:mm:a'), moment(timeSlots.fourth_slot.to_time, 'HH:mm:a'))) {
                timeSlots.fourth_slot.count += 1;
                if (
                    timeSlots.fourth_slot.min_price == 0 ||
                    // timeSlots.fourth_slot.min_price > route.selling_price
                    timeSlots.fourth_slot.min_price > route.discounted_selling_price
                ) {
                    // timeSlots.fourth_slot.min_price = route.selling_price;
                    timeSlots.fourth_slot.min_price = route.discounted_selling_price;
                }
            }
        });
        return timeSlots;
    }

    /** [@Description: Converting to base64]
     * @author: Prashant Joshi at 23-09-2025 **/
    static convertToBase64(requestBody) {
        const buffRequestBody = Buffer.from(requestBody);
        const base64RequestBody = buffRequestBody.toString('base64');
        return base64RequestBody;
    }

    /** [@Description: Unzipping to json]
     * @author: Prashant Joshi at 23-09-2025 **/
    static async unzipToJson(response) {
        const results: any = await new Promise((resolve) => {
            zlib.gunzip(response, function (_err, output) {
                resolve(output.toString());
            });
        });

        return JSON.parse(results);
    }

    /** [@Description: Getting adult count]
     * @author: Prashant Joshi at 23-09-2025 **/
    static getAdultCount(searchReq: StartRoutingDto) {
        const adult = searchReq.paxes.filter((item) => {
            return item.type == 'ADT';
        });

        let count = 0;
        if (adult.length > 0) {
            count = adult[0].quantity;
        }
        return count;
    }

    /** [@Description: Getting child count]
     * @author: Prashant Joshi at 23-09-2025 **/
    static getChildCount(searchReq: StartRoutingDto) {
        const child = searchReq.paxes.filter((item) => {
            return item.type == 'CHD';
        });

        let count = 0;
        if (child.length > 0) {
            count = child[0].quantity;
        }
        return count;
    }

    /** [@Description: Getting infant count]
     * @author: Prashant Joshi at 23-09-2025 **/
    static getInfantCount(searchReq: StartRoutingDto) {
        const infant = searchReq.paxes.filter((item) => {
            return item.type == 'INF';
        });

        let count = 0;
        if (infant.length > 0) {
            count = infant[0].quantity;
        }
        return count;
    }

    /** [@Description: Creating qunar sign]
     * @author: Prashant Joshi at 23-09-2025 **/
    static createQunarSign(data) {
        const tag = data.tag == 'queryBalance' ? 'flight.international.site' : 'flight.international.site.api';

        let requestString = `createTime=${data.currentTimestamp}`;
        requestString += `key=${data.providerCred.key}`;
        requestString += `params=` + JSON.stringify(JSON.parse(data.params));
        requestString += `tag=${tag}.${data.tag}`;
        requestString += `token=${data.providerCred.token}`;

        const signature = md5(requestString);

        let requestParams = '';
        requestParams += `createTime=${data.currentTimestamp}`;
        requestParams += `&params=${encodeURI(JSON.stringify(JSON.parse(data.params)))}`;
        requestParams += `&tag=${tag}.${data.tag}`;
        requestParams += `&token=${encodeURI(data.providerCred.token)}`;
        requestParams += `&sign=${encodeURI(signature)}`;

        return requestParams;
    }

    /** [@Description: Getting trip type qunar]
     * @author: Prashant Joshi at 23-09-2025 **/
    static getTripTypeQunar(trip) {
        switch (trip.toLowerCase()) {
            case 'oneway':
                trip = 'ow';
                break;
            case 'roundtrip':
                trip = 'rt';
                break;
        }

        return trip;
    }

    /** [@Description: Converting cabin class code]
     * @author: Prashant Joshi at 23-09-2025 **/
    static convertCabinClassCode(providerCode, cabinCode, convertToProvider = false) {
        let cabin = '';
        switch (providerCode.toUpperCase()) {
            case 'PK':
                if (convertToProvider == true) {
                    if (cabinCode.toLowerCase() == 'business') {
                        cabin = 'Business';
                    } else if (cabinCode.toLowerCase() == 'first') {
                        cabin = 'First';
                    } else if (cabinCode.toLowerCase() == 'premium_economy') {
                        cabin = 'PremiumEconomy';
                    } else {
                        cabin = 'Economy';
                    }
                } else {
                    if (cabinCode.toLowerCase() == 'economy') {
                        cabin = 'economy';
                    } else if (cabinCode.toLowerCase() == 'business') {
                        cabin = 'business';
                    } else if (cabinCode.toLowerCase() == 'first') {
                        cabin = 'first';
                    } else if (cabinCode.toLowerCase() == 'premium economy') {
                        cabin = 'premium_economy';
                    }
                }
                break;
            case 'MY':
                if (convertToProvider == true) {
                    if (cabinCode.toLowerCase() == 'business') {
                        cabin = 'C';
                    } else if (cabinCode.toLowerCase() == 'first') {
                        cabin = 'F';
                    } else if (cabinCode.toLowerCase() == 'premium_economy') {
                        cabin = 'S';
                    } else {
                        cabin = 'Y';
                    }
                } else {
                    if (cabinCode && cabinCode.toUpperCase() == 'C') {
                        cabin = 'business';
                    } else if (cabinCode && cabinCode.toUpperCase() == 'F') {
                        cabin = 'first';
                    } else if (cabinCode && cabinCode.toUpperCase() == 'S') {
                        cabin = 'premium_economy';
                    } else {
                        cabin = 'economy';
                    }
                }
                break;
            case 'QN':
                if (convertToProvider == true) {
                    if (cabinCode.toLowerCase() == 'business') {
                        cabin = 'business';
                    } else if (cabinCode.toLowerCase() == 'first') {
                        cabin = 'first';
                    } else if (cabinCode.toLowerCase() == 'economy') {
                        cabin = 'economy';
                    } else {
                        cabin = 'all';
                    }
                } else {
                    if (cabinCode.toLowerCase() == 'business') {
                        cabin = 'business';
                    } else if (cabinCode.toLowerCase() == 'first') {
                        cabin = 'first';
                    } else {
                        cabin = 'economy';
                    }
                }
                break;
            case 'TBO':
                if (convertToProvider == true) {
                    if (cabinCode.toLowerCase() == 'business') {
                        cabin = '4';
                    } else if (cabinCode.toLowerCase() == 'first') {
                        cabin = '6';
                    } else if (cabinCode.toLowerCase() == 'economy') {
                        cabin = '2';
                    } else if (cabinCode.toLowerCase() == 'premium_economy') {
                        cabin = '3';
                    } else if (cabinCode.toLowerCase() == 'premium_business') {
                        cabin = '5';
                    } else if(cabinCode.toLowerCase() == 'all'){
                        cabin = '1';
                    }
                } else {
                    if (cabinCode && cabinCode == '1') {
                        cabin = 'all';
                    } else if (cabinCode && cabinCode == '2') {
                        cabin = 'economy';
                    } else if (cabinCode && cabinCode == '3') {
                        cabin = 'premium_economy';
                    } else if (cabinCode && cabinCode == '4') {
                        cabin = 'business_class';
                    } else if (cabinCode && cabinCode == '5') {
                        cabin = 'premium_business';
                    } else if (cabinCode && cabinCode == '6') {
                        cabin = 'first_class';
                    } else {
                        cabin = 'economy';
                    }
                }
                break;
        }

        return cabin;
    }

    /** [@Description: Generating log file]
     * @author: Prashant Joshi at 23-09-2025 **/
    static generateLogFile(fileName, logData, folderName) {
        const projectPath = process.cwd();
        const logsPath = path.join(projectPath, '../', 'logs/flight/' + folderName + '/');
        fileName = logsPath + fileName + '.json';
        console.log("LOG PATH:", logsPath);
        console.log("FILE PATH:", fileName);

        try {
            /* In case of directory does not exist create one */
            if (!fs.existsSync(logsPath)) {
                fs.mkdirSync(logsPath, { recursive: true });
            }

            /* Check if file is already exist delete that file */
            if (fs.existsSync(fileName) == true) {
                fs.unlinkSync(fileName);
            }

            /* Write the data into the file */
            fs.promises.writeFile(fileName, JSON.stringify(logData));
        } catch (error) {
            console.log(error);
        }
    }

    /** [@Description: Converting minutes to hours]
     * @author: Prashant Joshi at 23-09-2025 **/
    static convertMinutesToHours(minutes) {
        const totalHours = Math.floor(minutes / 60);
        const totalMinutes = minutes % 60;

        return totalHours + 'h ' + totalMinutes + 'm';
    }

    /** [@Description: Checking if mystifly is for search]
     * @author: Prashant Joshi at 23-09-2025 **/
    static isMystiflyForSearch(searchReq: StartRoutingDto) {
        let isMystifly = true;

        /* Location under Cuba country are not supported by Mystifly */
        const cubaAirports = [
            'AVI',
            'BCA',
            'BYM',
            'CCC',
            'CFG',
            'CMW',
            'CYO',
            'GAO',
            'GER',
            'HAV',
            'HOG',
            'ICR',
            'LCL',
            'MJG',
            'MOA',
            'MZO',
            'NBW',
            'PST',
            'SCU',
            'SNJ',
            'SNU',
            'SZJ',
            'TND',
            'UMA',
            'UPA',
            'UPB',
            'USS',
            'VRA',
            'VRO',
            'VTU',
        ];

        if (cubaAirports.includes(searchReq.searchAirLegs[0].origin) || cubaAirports.includes(searchReq.searchAirLegs[0].destination)) {
            isMystifly = false;
        }

        return isMystifly;
    }

    /** [@Description: Checking if value is valid]
     * @author: Prashant Joshi at 23-09-2025 **/
    static isValidValue(value: string): boolean {
        return value !== null && value !== undefined && value !== '';
    }

    /** [@Description: Converting hours to minutes]
     * @author: Prashant Joshi at 08-10-2025 **/
    static convertHoursToMinutes(timeString) {
        const [hours, minutes] = timeString.split('h ').map((part) => parseInt(part, 10));

        if (!isNaN(hours) && !isNaN(minutes)) {
            const totalMinutes = hours * 60 + minutes;
            return totalMinutes;
        } else {
            return 0;
        }
    }

    /** [@Description: Getting trip type tbo]
     * @author: Prashant Joshi at 08-10-2025 **/
    static getTripTypeTbo(trip) {
        switch (trip.toLowerCase()) {
            case 'oneway':
                trip = '1';
                break;
            case 'roundtrip':
                trip = '2';
                break;
            case 'multi-city':
                trip = '3';
                break;
        }

        return trip;
    }

    /** [@Description: Converting currency]
     * @author: Prashant Joshi at 08-10-2025 **/
    static currencyConversion(netRate, providerCurrency, preferredCurrency: string) {
        /* Get Currency Rate */
        const currencyFile = join(process.cwd(), 'json', 'currency.json');
        const currencyData = JSON.parse(fs.readFileSync(currencyFile, 'utf8'));

        const providerCurrencyData = currencyData[providerCurrency.toUpperCase()];
        /* Convert to USD first */
        const usdRate = netRate / providerCurrencyData?.rate;

        /* Convert to preferred currency */
        const preferredCurrencyData = currencyData[preferredCurrency.toUpperCase()];
        const convertedRate = usdRate * preferredCurrencyData?.rate;

        return Math.ceil(convertedRate);
    }

    /** [@Description: Encrypting text]
     * @author: Prashant Joshi at 08-10-2025 **/
    static encrypt(text: string): string {
        return CryptoJS.AES.encrypt(text, cryptoSecretKey).toString();
    }

    /** [@Description: Decrypting text]
     * @author: Prashant Joshi at 08-10-2025 **/
    static decrypt(encryptedText: string): string {
        const bytes = CryptoJS.AES.decrypt(encryptedText, cryptoSecretKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    }

    /** [@Description: Converting time string]
     * @author: Prashant Joshi at 08-10-2025 **/
    static convertTimeString(minutes: number) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }

    static generateRandomString(length?: number): string {
        const letters = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const timestamp = Date.now().toString();
        const suffix = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * 36)]).join('');
        const middleIndex = Math.floor(timestamp.length / 2);
        const uniqueString = timestamp
            .split('')
            .map((char, i) => (i < middleIndex ? char + suffix[Math.floor(Math.random() * suffix.length)] : char))
            .join('');

        return uniqueString.slice(0, length || 10);
    }

    static calculateAge(dateOfBirth: string): number {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    static calculatePagination(totalResults: number, page: number, limit: number): Pagination {
        const totalPages = Math.ceil(totalResults / limit);
        return {
            page,
            limit,
            totalPages,
            totalFilteredResults: totalResults,
        };
    }

    static calculatePriceRange<T>(items: T[], priceProperty: string = 'selling'): [number, number] {
        if (!items.length) return [0, 0];

        const prices = items.map((item) => (item as any)?.prices?.[priceProperty] || (item as any)?.[priceProperty]).filter((price) => typeof price === 'number' && !isNaN(price));

        if (!prices.length) return [0, 0];

        return [Math.min(...prices), Math.max(...prices)] as [number, number];
    }

    static getCurrencySymbol(currency: string): string {
        const currencyMap: Record<string, string> = {
            USD: '$',
            EUR: '€',
            GBP: '£',
            INR: '₹',
            AED: 'د.إ',
            JPY: '¥',
            CNY: '¥',
            AUD: 'A$',
            CAD: 'C$',
            CHF: 'CHF',
            SGD: 'S$',
            HKD: 'HK$',
            NZD: 'NZ$',
            SEK: 'kr',
            NOK: 'kr',
            DKK: 'kr',
            PLN: 'zł',
            CZK: 'Kč',
            HUF: 'Ft',
            RUB: '₽',
            BRL: 'R$',
            MXN: '$',
            ARS: '$',
            CLP: '$',
            COP: '$',
            PEN: 'S/',
            UYU: '$U',
            VEF: 'Bs',
            KRW: '₩',
            THB: '฿',
            MYR: 'RM',
            IDR: 'Rp',
            PHP: '₱',
            VND: '₫',
            TRY: '₺',
            ILS: '₪',
            EGP: '£',
            ZAR: 'R',
            NGN: '₦',
            KES: 'KSh',
            GHS: '₵',
            MAD: 'د.م.',
            TND: 'د.ت',
            DZD: 'د.ج',
            LBP: 'ل.ل',
            JOD: 'د.ا',
            KWD: 'د.ك',
            QAR: 'ر.ق',
            SAR: 'ر.س',
            OMR: 'ر.ع.',
            BHD: 'د.ب',
            PKR: '₨',
            BDT: '৳',
            LKR: '₨',
            NPR: '₨',
            AFN: '؋',
            UZS: 'лв',
            KZT: '₸',
            GEL: '₾',
            AMD: '֏',
            AZN: '₼',
            BYN: 'Br',
            MDL: 'L',
            UAH: '₴',
            RON: 'lei',
            BGN: 'лв',
            HRK: 'kn',
            RSD: 'дин.',
            MKD: 'ден',
            ALL: 'L',
            BAM: 'КМ',
            ISK: 'kr',
            FJD: 'FJ$',
            PGK: 'K',
            SBD: 'SI$',
            VUV: 'Vt',
            WST: 'WS$',
            TOP: 'T$',
        };

        return currencyMap[currency] || currency;
    }

    static bucketToRange(bucketLabel: string): [number, number] {
        // Extract currency symbol and remove it
        const cleanLabel = bucketLabel.replace(/[^\d\s-]/g, '').trim();

        // Split by dash and extract numbers
        const parts = cleanLabel.split('-').map((part) => part.trim());

        if (parts.length !== 2) {
            return [0, 0];
        }

        const min = parseInt(parts[0]) || 0;
        const max = parseInt(parts[1]) || 0;

        return [min, max];
    }

    static generatePriceBuckets<T>(items: T[], currencySymbol: string = '$', priceProperty: string = 'selling'): Record<string, number> {
        const buckets: Record<string, number> = {};

        // Define bucket ranges
        const bucketRanges = [
            { label: `${currencySymbol}0 - ${currencySymbol}100`, min: 0, max: 100 },
            { label: `${currencySymbol}101 - ${currencySymbol}300`, min: 101, max: 300 },
            { label: `${currencySymbol}301 - ${currencySymbol}500`, min: 301, max: 500 },
            { label: `${currencySymbol}501 - ${currencySymbol}1000`, min: 501, max: 1000 },
            { label: `${currencySymbol}1001 - ${currencySymbol}5000`, min: 1001, max: 5000 },
            { label: `${currencySymbol}5001 - ${currencySymbol}10000`, min: 5001, max: 10000 },
            { label: `${currencySymbol}10001 - ${currencySymbol}20000`, min: 10001, max: 20000 },
            { label: `${currencySymbol}20001+`, min: 20001, max: Infinity },
        ];

        // Count items in each bucket
        items.forEach((item) => {
            const price = (item as any)?.prices?.[priceProperty] || (item as any)?.[priceProperty];
            if (typeof price === 'number' && !isNaN(price)) {
                bucketRanges.forEach((bucket) => {
                    if (price >= bucket.min && price <= bucket.max) {
                        buckets[bucket.label] = (buckets[bucket.label] || 0) + 1;
                    }
                });
            }
        });

        return buckets;
    }

    static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance;
    }

    static toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    }
}
