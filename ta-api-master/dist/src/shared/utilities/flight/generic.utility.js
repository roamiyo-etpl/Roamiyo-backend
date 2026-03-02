"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Generic = void 0;
const moment_1 = __importDefault(require("moment"));
const zlib = __importStar(require("zlib"));
const md5_1 = __importDefault(require("md5"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const path_1 = require("path");
const crypto_js_1 = __importDefault(require("crypto-js"));
const cryptoSecretKey = '13jHg1P5ks16QW9Q1B2u12F12ADxo';
class Generic {
    static getMinPriceFlight(routes, priceType) {
        return Math.min.apply(null, routes.map((item) => item[priceType]));
    }
    static getMaxPriceFLight(routes, priceType) {
        return Math.max.apply(null, routes.map((item) => item[priceType]));
    }
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
    static getAirlineCounts(routes) {
        const airlineList = [];
        routes.forEach((route) => {
            const airlineData = {
                airline_name: route.airline_name,
                airline_code: route.airline,
                selling_price: route.discounted_selling_price,
            };
            airlineList.push(airlineData);
        });
        const result = [
            ...airlineList
                .reduce((mp, o) => {
                if (!mp.has(o.airline_code)) {
                    mp.set(o.airline_code, { ...o, count: 0 });
                }
                mp.get(o.airline_code).count++;
                return mp;
            }, new Map())
                .values(),
        ];
        return result;
    }
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
                sourceDate = (0, moment_1.default)(route.routes[routeType].stops[0][type], 'HH:mm:a');
            }
            else {
                sourceDate = (0, moment_1.default)(route.routes[routeType].stops[route.routes[routeType].stops.length - 1][type], 'HH:mm:a');
            }
            if (sourceDate.isBetween((0, moment_1.default)(timeSlots.first_slot.from_time, 'HH:mm:a'), (0, moment_1.default)(timeSlots.first_slot.to_time, 'HH:mm:a'))) {
                timeSlots.first_slot.count += 1;
                if (timeSlots.first_slot.min_price == 0 ||
                    timeSlots.first_slot.min_price > route.discounted_selling_price) {
                    timeSlots.first_slot.min_price = route.discounted_selling_price;
                }
            }
            if (sourceDate.isBetween((0, moment_1.default)(timeSlots.second_slot.from_time, 'HH:mm:a'), (0, moment_1.default)(timeSlots.second_slot.to_time, 'HH:mm:a'))) {
                timeSlots.second_slot.count += 1;
                if (timeSlots.second_slot.min_price == 0 ||
                    timeSlots.second_slot.min_price > route.discounted_selling_price) {
                    timeSlots.second_slot.min_price = route.discounted_selling_price;
                }
            }
            if (sourceDate.isBetween((0, moment_1.default)(timeSlots.third_slot.from_time, 'HH:mm:a'), (0, moment_1.default)(timeSlots.third_slot.to_time, 'HH:mm:a'))) {
                timeSlots.third_slot.count += 1;
                if (timeSlots.third_slot.min_price == 0 ||
                    timeSlots.third_slot.min_price > route.discounted_selling_price) {
                    timeSlots.third_slot.min_price = route.discounted_selling_price;
                }
            }
            if (sourceDate.isBetween((0, moment_1.default)(timeSlots.fourth_slot.from_time, 'HH:mm:a'), (0, moment_1.default)(timeSlots.fourth_slot.to_time, 'HH:mm:a'))) {
                timeSlots.fourth_slot.count += 1;
                if (timeSlots.fourth_slot.min_price == 0 ||
                    timeSlots.fourth_slot.min_price > route.discounted_selling_price) {
                    timeSlots.fourth_slot.min_price = route.discounted_selling_price;
                }
            }
        });
        return timeSlots;
    }
    static convertToBase64(requestBody) {
        const buffRequestBody = Buffer.from(requestBody);
        const base64RequestBody = buffRequestBody.toString('base64');
        return base64RequestBody;
    }
    static async unzipToJson(response) {
        const results = await new Promise((resolve) => {
            zlib.gunzip(response, function (_err, output) {
                resolve(output.toString());
            });
        });
        return JSON.parse(results);
    }
    static getAdultCount(searchReq) {
        const adult = searchReq.paxes.filter((item) => {
            return item.type == 'ADT';
        });
        let count = 0;
        if (adult.length > 0) {
            count = adult[0].quantity;
        }
        return count;
    }
    static getChildCount(searchReq) {
        const child = searchReq.paxes.filter((item) => {
            return item.type == 'CHD';
        });
        let count = 0;
        if (child.length > 0) {
            count = child[0].quantity;
        }
        return count;
    }
    static getInfantCount(searchReq) {
        const infant = searchReq.paxes.filter((item) => {
            return item.type == 'INF';
        });
        let count = 0;
        if (infant.length > 0) {
            count = infant[0].quantity;
        }
        return count;
    }
    static createQunarSign(data) {
        const tag = data.tag == 'queryBalance' ? 'flight.international.site' : 'flight.international.site.api';
        let requestString = `createTime=${data.currentTimestamp}`;
        requestString += `key=${data.providerCred.key}`;
        requestString += `params=` + JSON.stringify(JSON.parse(data.params));
        requestString += `tag=${tag}.${data.tag}`;
        requestString += `token=${data.providerCred.token}`;
        const signature = (0, md5_1.default)(requestString);
        let requestParams = '';
        requestParams += `createTime=${data.currentTimestamp}`;
        requestParams += `&params=${encodeURI(JSON.stringify(JSON.parse(data.params)))}`;
        requestParams += `&tag=${tag}.${data.tag}`;
        requestParams += `&token=${encodeURI(data.providerCred.token)}`;
        requestParams += `&sign=${encodeURI(signature)}`;
        return requestParams;
    }
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
    static convertCabinClassCode(providerCode, cabinCode, convertToProvider = false) {
        let cabin = '';
        switch (providerCode.toUpperCase()) {
            case 'PK':
                if (convertToProvider == true) {
                    if (cabinCode.toLowerCase() == 'business') {
                        cabin = 'Business';
                    }
                    else if (cabinCode.toLowerCase() == 'first') {
                        cabin = 'First';
                    }
                    else if (cabinCode.toLowerCase() == 'premium_economy') {
                        cabin = 'PremiumEconomy';
                    }
                    else {
                        cabin = 'Economy';
                    }
                }
                else {
                    if (cabinCode.toLowerCase() == 'economy') {
                        cabin = 'economy';
                    }
                    else if (cabinCode.toLowerCase() == 'business') {
                        cabin = 'business';
                    }
                    else if (cabinCode.toLowerCase() == 'first') {
                        cabin = 'first';
                    }
                    else if (cabinCode.toLowerCase() == 'premium economy') {
                        cabin = 'premium_economy';
                    }
                }
                break;
            case 'MY':
                if (convertToProvider == true) {
                    if (cabinCode.toLowerCase() == 'business') {
                        cabin = 'C';
                    }
                    else if (cabinCode.toLowerCase() == 'first') {
                        cabin = 'F';
                    }
                    else if (cabinCode.toLowerCase() == 'premium_economy') {
                        cabin = 'S';
                    }
                    else {
                        cabin = 'Y';
                    }
                }
                else {
                    if (cabinCode && cabinCode.toUpperCase() == 'C') {
                        cabin = 'business';
                    }
                    else if (cabinCode && cabinCode.toUpperCase() == 'F') {
                        cabin = 'first';
                    }
                    else if (cabinCode && cabinCode.toUpperCase() == 'S') {
                        cabin = 'premium_economy';
                    }
                    else {
                        cabin = 'economy';
                    }
                }
                break;
            case 'QN':
                if (convertToProvider == true) {
                    if (cabinCode.toLowerCase() == 'business') {
                        cabin = 'business';
                    }
                    else if (cabinCode.toLowerCase() == 'first') {
                        cabin = 'first';
                    }
                    else if (cabinCode.toLowerCase() == 'economy') {
                        cabin = 'economy';
                    }
                    else {
                        cabin = 'all';
                    }
                }
                else {
                    if (cabinCode.toLowerCase() == 'business') {
                        cabin = 'business';
                    }
                    else if (cabinCode.toLowerCase() == 'first') {
                        cabin = 'first';
                    }
                    else {
                        cabin = 'economy';
                    }
                }
                break;
            case 'TBO':
                if (convertToProvider == true) {
                    if (cabinCode.toLowerCase() == 'business') {
                        cabin = '4';
                    }
                    else if (cabinCode.toLowerCase() == 'first') {
                        cabin = '6';
                    }
                    else if (cabinCode.toLowerCase() == 'economy') {
                        cabin = '2';
                    }
                    else if (cabinCode.toLowerCase() == 'premium_economy') {
                        cabin = '3';
                    }
                    else if (cabinCode.toLowerCase() == 'premium_business') {
                        cabin = '5';
                    }
                    else if (cabinCode.toLowerCase() == 'all') {
                        cabin = '1';
                    }
                }
                else {
                    if (cabinCode && cabinCode == '1') {
                        cabin = 'all';
                    }
                    else if (cabinCode && cabinCode == '2') {
                        cabin = 'economy';
                    }
                    else if (cabinCode && cabinCode == '3') {
                        cabin = 'premium_economy';
                    }
                    else if (cabinCode && cabinCode == '4') {
                        cabin = 'business_class';
                    }
                    else if (cabinCode && cabinCode == '5') {
                        cabin = 'premium_business';
                    }
                    else if (cabinCode && cabinCode == '6') {
                        cabin = 'first_class';
                    }
                    else {
                        cabin = 'economy';
                    }
                }
                break;
        }
        return cabin;
    }
    static generateLogFile(fileName, logData, folderName) {
        const projectPath = process.cwd();
        const logsPath = path.join(projectPath, '../', 'logs/flight/' + folderName + '/');
        fileName = logsPath + fileName + '.json';
        try {
            if (!fs.existsSync(logsPath)) {
                fs.mkdirSync(logsPath, { recursive: true });
            }
            if (fs.existsSync(fileName) == true) {
                fs.unlinkSync(fileName);
            }
            fs.promises.writeFile(fileName, JSON.stringify(logData));
        }
        catch (error) {
            console.log(error);
        }
    }
    static convertMinutesToHours(minutes) {
        const totalHours = Math.floor(minutes / 60);
        const totalMinutes = minutes % 60;
        return totalHours + 'h ' + totalMinutes + 'm';
    }
    static isMystiflyForSearch(searchReq) {
        let isMystifly = true;
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
    static isValidValue(value) {
        return value !== null && value !== undefined && value !== '';
    }
    static convertHoursToMinutes(timeString) {
        const [hours, minutes] = timeString.split('h ').map((part) => parseInt(part, 10));
        if (!isNaN(hours) && !isNaN(minutes)) {
            const totalMinutes = hours * 60 + minutes;
            return totalMinutes;
        }
        else {
            return 0;
        }
    }
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
    static currencyConversion(netRate, providerCurrency, preferredCurrency) {
        const currencyFile = (0, path_1.join)(process.cwd(), 'json', 'currency.json');
        const currencyData = JSON.parse(fs.readFileSync(currencyFile, 'utf8'));
        const providerCurrencyData = currencyData[providerCurrency.toUpperCase()];
        const usdRate = netRate / providerCurrencyData?.rate;
        const preferredCurrencyData = currencyData[preferredCurrency.toUpperCase()];
        const convertedRate = usdRate * preferredCurrencyData?.rate;
        return Math.ceil(convertedRate);
    }
    static encrypt(text) {
        return crypto_js_1.default.AES.encrypt(text, cryptoSecretKey).toString();
    }
    static decrypt(encryptedText) {
        const bytes = crypto_js_1.default.AES.decrypt(encryptedText, cryptoSecretKey);
        return bytes.toString(crypto_js_1.default.enc.Utf8);
    }
    static convertTimeString(minutes) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
    static generateRandomString(length) {
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
    static calculateAge(dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }
    static calculatePagination(totalResults, page, limit) {
        const totalPages = Math.ceil(totalResults / limit);
        return {
            page,
            limit,
            totalPages,
            totalFilteredResults: totalResults,
        };
    }
    static calculatePriceRange(items, priceProperty = 'selling') {
        if (!items.length)
            return [0, 0];
        const prices = items.map((item) => item?.prices?.[priceProperty] || item?.[priceProperty]).filter((price) => typeof price === 'number' && !isNaN(price));
        if (!prices.length)
            return [0, 0];
        return [Math.min(...prices), Math.max(...prices)];
    }
    static getCurrencySymbol(currency) {
        const currencyMap = {
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
    static bucketToRange(bucketLabel) {
        const cleanLabel = bucketLabel.replace(/[^\d\s-]/g, '').trim();
        const parts = cleanLabel.split('-').map((part) => part.trim());
        if (parts.length !== 2) {
            return [0, 0];
        }
        const min = parseInt(parts[0]) || 0;
        const max = parseInt(parts[1]) || 0;
        return [min, max];
    }
    static generatePriceBuckets(items, currencySymbol = '$', priceProperty = 'selling') {
        const buckets = {};
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
        items.forEach((item) => {
            const price = item?.prices?.[priceProperty] || item?.[priceProperty];
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
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance;
    }
    static toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
}
exports.Generic = Generic;
//# sourceMappingURL=generic.utility.js.map