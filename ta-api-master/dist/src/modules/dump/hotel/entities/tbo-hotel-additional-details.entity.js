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
exports.TboHotelAdditionalDetailsEntity = void 0;
const typeorm_1 = require("typeorm");
const tbo_hotel_images_entity_1 = require("./tbo-hotel-images.entity");
let TboHotelAdditionalDetailsEntity = class TboHotelAdditionalDetailsEntity {
    id;
    hotelCode;
    supplierCode;
    hotelName;
    rating;
    latitude;
    longitude;
    address;
    city;
    state;
    country;
    cityCode;
    stateCode;
    countryCode;
    pincode;
    heroImage;
    amenities;
    description;
    hotelEmail;
    hotelPhones;
    boardCodes;
    websiteUrl;
    interestPoints;
    terminals;
    status;
    createdAt;
    updatedAt;
    images;
    hotelVector = null;
    hotelNameNormalized = null;
};
exports.TboHotelAdditionalDetailsEntity = TboHotelAdditionalDetailsEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hotel_code', type: 'varchar', length: 50, unique: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "hotelCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'supplier_code', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "supplierCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hotel_name', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "hotelName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rating', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], TboHotelAdditionalDetailsEntity.prototype, "rating", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'latitude', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "latitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'longitude', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "longitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'address', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'city', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'state', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'country', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "country", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'city_code', type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "cityCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'state_code', type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "stateCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'country_code', type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "countryCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pincode', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "pincode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hero_image', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "heroImage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'amenities', type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], TboHotelAdditionalDetailsEntity.prototype, "amenities", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'description', type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], TboHotelAdditionalDetailsEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hotel_email', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "hotelEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hotel_phones', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], TboHotelAdditionalDetailsEntity.prototype, "hotelPhones", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'board_codes', type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], TboHotelAdditionalDetailsEntity.prototype, "boardCodes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'website_url', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "websiteUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'interest_points', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], TboHotelAdditionalDetailsEntity.prototype, "interestPoints", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'terminals', type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], TboHotelAdditionalDetailsEntity.prototype, "terminals", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'status', type: 'enum', enum: ['PENDING', 'COMPLETE'], default: 'PENDING' }),
    __metadata("design:type", String)
], TboHotelAdditionalDetailsEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], TboHotelAdditionalDetailsEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], TboHotelAdditionalDetailsEntity.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => tbo_hotel_images_entity_1.TboHotelImagesEntity, (image) => image.hotel),
    __metadata("design:type", Array)
], TboHotelAdditionalDetailsEntity.prototype, "images", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hotel_vector', type: 'tsvector', nullable: true }),
    __metadata("design:type", Object)
], TboHotelAdditionalDetailsEntity.prototype, "hotelVector", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hotel_name_normalized', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], TboHotelAdditionalDetailsEntity.prototype, "hotelNameNormalized", void 0);
exports.TboHotelAdditionalDetailsEntity = TboHotelAdditionalDetailsEntity = __decorate([
    (0, typeorm_1.Entity)('tbo_additional_hotel_details'),
    (0, typeorm_1.Index)(['hotelCode', 'supplierCode']),
    (0, typeorm_1.Index)(['city', 'state', 'country']),
    (0, typeorm_1.Index)(['rating']),
    (0, typeorm_1.Index)(['hotelVector']),
    (0, typeorm_1.Index)(['hotelNameNormalized'])
], TboHotelAdditionalDetailsEntity);
//# sourceMappingURL=tbo-hotel-additional-details.entity.js.map