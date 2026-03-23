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
exports.CountryEntity = void 0;
const typeorm_1 = require("typeorm");
let CountryEntity = class CountryEntity {
    countryId;
    countryName;
    iso3;
    iso2;
    numericCode;
    phonecode;
    capital;
    currency;
    currencyName;
    currencySymbol;
    population;
    gdp;
    region;
    regionId;
    subregion;
    subregionId;
    nationality;
    timezones;
    translations;
    latitude;
    longitude;
    emojiU;
    createdAt;
    updatedAt;
};
exports.CountryEntity = CountryEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'country_id', type: 'int' }),
    __metadata("design:type", Number)
], CountryEntity.prototype, "countryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'country_name', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], CountryEntity.prototype, "countryName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'iso3', type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "iso3", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'iso2', type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], CountryEntity.prototype, "iso2", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'numeric_code', type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "numericCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'phonecode', type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "phonecode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'capital', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "capital", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'currency', type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'currency_name',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "currencyName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'currency_symbol',
        type: 'varchar',
        length: 10,
        nullable: true,
    }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "currencySymbol", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'population', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "population", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gdp', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "gdp", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'region', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "region", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'region_id', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "regionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'subregion', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "subregion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'subregion_id', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "subregionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'nationality', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "nationality", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'timezones', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "timezones", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'translations', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "translations", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'latitude', type: 'double precision', nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "latitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'longitude', type: 'double precision', nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "longitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'emojiU', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], CountryEntity.prototype, "emojiU", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], CountryEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], CountryEntity.prototype, "updatedAt", void 0);
exports.CountryEntity = CountryEntity = __decorate([
    (0, typeorm_1.Entity)('country')
], CountryEntity);
//# sourceMappingURL=country.entity.js.map