"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotelDumpController = void 0;
const common_1 = require("@nestjs/common");
const hotel_dump_service_1 = require("./hotel-dump.service");
const hotel_detail_dto_1 = require("./dtos/hotel-detail.dto");
const standard_api_headers_constant_1 = require("../../../shared/constants/standard-api-headers.constant");
const swagger_1 = require("@nestjs/swagger");
const custom_header_decorator_1 = require("../../../shared/decorators/common/custom-header.decorator");
const hotel_autocomplete_dto_1 = require("./dtos/hotel-autocomplete.dto");
const standard_api_responses_constant_1 = require("../../../shared/constants/standard-api-responses.constant");
const transfer_data_to_hotel_content_dto_1 = require("./dtos/transfer-data-to-hotel-content.dto");
let HotelDumpController = class HotelDumpController {
    hotelDumpService;
    constructor(hotelDumpService) {
        this.hotelDumpService = hotelDumpService;
    }
    async getHotelAutocomplete(hotelAutocompleteDto, headers) {
        try {
            return await this.hotelDumpService.getHotelAutocomplete(hotelAutocompleteDto);
        }
        catch (error) {
            throw new common_1.HttpException(error.message, error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getHotelDetails(hotelDetailRequestDto, headers) {
        try {
            return await this.hotelDumpService.getHotelDetails(hotelDetailRequestDto.hotelId);
        }
        catch (error) {
            throw new common_1.HttpException(error.message, error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getHotelRoomContent(hotelDetailRequestDto, headers) {
        try {
            return await this.hotelDumpService.getHotelRoomContent(hotelDetailRequestDto.hotelId);
        }
        catch (error) {
            throw new common_1.HttpException(error.message, error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async transferDataToHotelContent(transferData, headers) {
        try {
            return await this.hotelDumpService.transferDataToHotelContent(transferData);
        }
        catch (error) {
            throw new common_1.HttpException(error.message, error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async addCountryList(headers) {
        try {
            return await this.hotelDumpService.addCountryList(headers);
        }
        catch (error) {
            throw new common_1.HttpException(error.message, error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async addCityList(headers, countryCode) {
        try {
            return await this.hotelDumpService.addCityList(headers, countryCode);
        }
        catch (error) {
            throw new common_1.HttpException(error.message, error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async dumpHotelBasicDetails(headers, cityCode) {
        try {
            return await this.hotelDumpService.dumpHotelBasicDetails(headers, cityCode);
        }
        catch (error) {
            throw new common_1.HttpException(error.message, error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async dumpHotelInfo(headers) {
        try {
            return await this.hotelDumpService.dumpHotelInfo(headers);
        }
        catch (error) {
            throw new common_1.HttpException(error.message, error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.HotelDumpController = HotelDumpController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get hotel autocomplete suggestions' }),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_SUCCESS_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_NOT_FOUND_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_BAD_REQUEST_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_UNPROCESSABLE_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_INTERNAL_SERVER_ERROR_RESPONSE),
    (0, common_1.Get)('autocomplete'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [hotel_autocomplete_dto_1.HotelAutocompleteDto, Object]),
    __metadata("design:returntype", Promise)
], HotelDumpController.prototype, "getHotelAutocomplete", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get hotel details by hotel code' }),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_SUCCESS_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_NOT_FOUND_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_BAD_REQUEST_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_UNPROCESSABLE_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_INTERNAL_SERVER_ERROR_RESPONSE),
    (0, common_1.Post)('detail'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [hotel_detail_dto_1.HotelDetailRequestDto, Object]),
    __metadata("design:returntype", Promise)
], HotelDumpController.prototype, "getHotelDetails", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get hotel room content by hotel code' }),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_SUCCESS_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_NOT_FOUND_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_BAD_REQUEST_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_UNPROCESSABLE_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_INTERNAL_SERVER_ERROR_RESPONSE),
    (0, common_1.Get)('room-content'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [hotel_detail_dto_1.HotelDetailRequestDto, Object]),
    __metadata("design:returntype", Promise)
], HotelDumpController.prototype, "getHotelRoomContent", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Transfer data to hotel content table' }),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_SUCCESS_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_NOT_FOUND_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_BAD_REQUEST_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_UNPROCESSABLE_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_INTERNAL_SERVER_ERROR_RESPONSE),
    (0, common_1.Post)('transfer-data'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [transfer_data_to_hotel_content_dto_1.TransferDataToHotelContent, Object]),
    __metadata("design:returntype", Promise)
], HotelDumpController.prototype, "transferDataToHotelContent", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Add country list dump from TBO API' }),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_SUCCESS_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_NOT_FOUND_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_BAD_REQUEST_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_UNPROCESSABLE_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_INTERNAL_SERVER_ERROR_RESPONSE),
    (0, common_1.Get)('country-list'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HotelDumpController.prototype, "addCountryList", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Add city list dump from TBO API' }),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_SUCCESS_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_NOT_FOUND_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_BAD_REQUEST_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_UNPROCESSABLE_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_INTERNAL_SERVER_ERROR_RESPONSE),
    (0, common_1.Get)('city-list'),
    (0, swagger_1.ApiQuery)({
        name: 'countryCode',
        required: false,
    }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Headers)()),
    __param(1, (0, common_1.Query)('countryCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], HotelDumpController.prototype, "addCityList", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Add hotel basic details list dump from TBO API' }),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_SUCCESS_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_NOT_FOUND_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_BAD_REQUEST_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_UNPROCESSABLE_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_INTERNAL_SERVER_ERROR_RESPONSE),
    (0, common_1.Get)('hotel-basic-details'),
    (0, swagger_1.ApiQuery)({
        name: 'cityCode',
        required: false,
    }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Headers)()),
    __param(1, (0, common_1.Query)('cityCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], HotelDumpController.prototype, "dumpHotelBasicDetails", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'update hotel information details from TBO API' }),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_SUCCESS_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_NOT_FOUND_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_BAD_REQUEST_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_UNPROCESSABLE_RESPONSE),
    (0, swagger_1.ApiResponse)(standard_api_responses_constant_1.SWG_INTERNAL_SERVER_ERROR_RESPONSE),
    (0, common_1.Get)('update-hotel-details'),
    __param(0, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HotelDumpController.prototype, "dumpHotelInfo", null);
exports.HotelDumpController = HotelDumpController = __decorate([
    (0, swagger_1.ApiTags)('Hotel Dump'),
    (0, swagger_1.ApiHeaders)([standard_api_headers_constant_1.SWG_HEADER_CURRENCY_PREFERENCE, standard_api_headers_constant_1.SWG_HEADER_IP_MANDATE, standard_api_headers_constant_1.SWG_HEADER_API_VERSION_MANDATE]),
    (0, custom_header_decorator_1.RequiredHeaders)([standard_api_headers_constant_1.DEC_HEADER_IP_ADDRESS_MANDATE, standard_api_headers_constant_1.DEC_HEADER_API_VERSION_MANDATE, standard_api_headers_constant_1.DEC_HEADER_CURRENCY_PREFERENCE_MANDATE]),
    (0, common_1.Controller)('dump/hotel'),
    __metadata("design:paramtypes", [hotel_dump_service_1.HotelDumpService])
], HotelDumpController);
//# sourceMappingURL=hotel-dump.controller.js.map