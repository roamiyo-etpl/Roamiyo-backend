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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartRoutingDto = exports.Paxes = exports.TravelPreference = exports.SearchAirLegs = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
class SearchAirLegs {
    departureDate;
    origin;
    destination;
}
exports.SearchAirLegs = SearchAirLegs;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Departure date for the flight',
        example: '2025-06-15',
        format: 'date',
    }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SearchAirLegs.prototype, "departureDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Origin airport code',
        example: 'NYC',
    }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SearchAirLegs.prototype, "origin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Destination airport code',
        example: 'LAX',
    }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SearchAirLegs.prototype, "destination", void 0);
class TravelPreference {
    maxStopsQuantity;
    cabinClass;
    airTripType;
    nearByAirports;
}
exports.TravelPreference = TravelPreference;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Maximum number of stops allowed',
        example: 2,
        minimum: 0,
    }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TravelPreference.prototype, "maxStopsQuantity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Cabin class preference',
        example: 'Economy',
        enum: ['Economy', 'Business', 'First', 'All', 'Premium_Economy'],
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TravelPreference.prototype, "cabinClass", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Type of air trip',
        example: 'oneway',
        enum: ['oneway', 'roundtrip', 'multi-city'],
    }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TravelPreference.prototype, "airTripType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Whether to include nearby airports',
        example: false,
        default: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], TravelPreference.prototype, "nearByAirports", void 0);
class Paxes {
    type;
    quantity;
}
exports.Paxes = Paxes;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Type of passenger',
        example: 'ADT',
        enum: ['ADT', 'CHD', 'INF'],
    }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Paxes.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Number of passengers of this type',
        example: 2,
        minimum: 1,
    }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], Paxes.prototype, "quantity", void 0);
class StartRoutingDto {
    searchAirLegs;
    travelPreferences;
    paxes;
}
exports.StartRoutingDto = StartRoutingDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Array of search air legs',
        type: [SearchAirLegs],
        example: [
            {
                departureDate: '2026-06-15',
                origin: 'NYC',
                destination: 'LAX',
            },
            {
                departureDate: '2026-06-20',
                origin: 'LAX',
                destination: 'NYC',
            },
        ],
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SearchAirLegs),
    __metadata("design:type", Array)
], StartRoutingDto.prototype, "searchAirLegs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Array of travel preferences',
        type: [TravelPreference],
        example: [
            {
                maxStopsQuantity: 2,
                cabinClass: 'Economy',
                airTripType: 'roundtrip',
                nearByAirports: false,
            },
        ],
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TravelPreference),
    __metadata("design:type", Array)
], StartRoutingDto.prototype, "travelPreferences", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Array of passenger information',
        type: [Paxes],
        example: [
            {
                type: 'ADT',
                quantity: 2,
            },
        ],
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => Paxes),
    __metadata("design:type", Array)
], StartRoutingDto.prototype, "paxes", void 0);
//# sourceMappingURL=start-routing.dto.js.map