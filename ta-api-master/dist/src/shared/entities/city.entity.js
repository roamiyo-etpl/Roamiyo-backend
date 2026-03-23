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
exports.CityEntity = void 0;
const typeorm_1 = require("typeorm");
let CityEntity = class CityEntity {
    cityId;
    cityName;
    cityCodeTbo;
    stateId;
    stateCode;
    stateName;
    countryId;
    countryCode;
    countryName;
    latitude;
    longitude;
    cityVector;
    cityNameNormalized;
    createdAt;
    updatedAt;
    hotelDumpUpdatedAt;
};
exports.CityEntity = CityEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'city_id', type: 'int' }),
    __metadata("design:type", Number)
], CityEntity.prototype, "cityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'city_name', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], CityEntity.prototype, "cityName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'city_code_tbo', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], CityEntity.prototype, "cityCodeTbo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'state_id', type: 'int' }),
    __metadata("design:type", Number)
], CityEntity.prototype, "stateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'state_code', type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], CityEntity.prototype, "stateCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'state_name', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], CityEntity.prototype, "stateName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'country_id', type: 'int' }),
    __metadata("design:type", Number)
], CityEntity.prototype, "countryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'country_code', type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], CityEntity.prototype, "countryCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'country_name', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], CityEntity.prototype, "countryName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'latitude', type: 'double precision' }),
    __metadata("design:type", Number)
], CityEntity.prototype, "latitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'longitude', type: 'double precision' }),
    __metadata("design:type", Number)
], CityEntity.prototype, "longitude", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_city_vector', { synchronize: false }),
    (0, typeorm_1.Column)({ name: 'city_vector', type: 'tsvector', nullable: true }),
    __metadata("design:type", Object)
], CityEntity.prototype, "cityVector", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_city_name_normalized', { synchronize: false }),
    (0, typeorm_1.Column)({ name: 'city_name_normalized', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], CityEntity.prototype, "cityNameNormalized", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], CityEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], CityEntity.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hotel_dump_updated_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], CityEntity.prototype, "hotelDumpUpdatedAt", void 0);
exports.CityEntity = CityEntity = __decorate([
    (0, typeorm_1.Entity)('city')
], CityEntity);
//# sourceMappingURL=city.entity.js.map