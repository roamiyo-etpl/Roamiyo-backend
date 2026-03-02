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
exports.TboAuthTokenService = void 0;
const common_1 = require("@nestjs/common");
const configuration_service_1 = require("../../configuration/configuration.service");
const s3bucket_utility_1 = require("../../../../shared/utilities/flight/s3bucket.utility");
const http_utility_1 = require("../../../../shared/utilities/flight/http.utility");
const supplier_log_utility_1 = require("../../../../shared/utilities/flight/supplier-log.utility");
let TboAuthTokenService = class TboAuthTokenService {
    configurationService;
    s3BucketService;
    supplierLogUtility;
    constructor(configurationService, s3BucketService, supplierLogUtility) {
        this.configurationService = configurationService;
        this.s3BucketService = s3BucketService;
        this.supplierLogUtility = supplierLogUtility;
    }
    async getAuthToken(searchRequest) {
        try {
            const authToken = await this.configurationService.getToken({ searchRequest, module: 'Flight' });
            if (authToken == 'undefined' || authToken == null || authToken == '') {
                const newAuthToken = await this.getNewAuthToken(searchRequest);
                await this.configurationService.updateAuthToken({ newAuthToken, searchRequest, module: 'Flight' });
                return newAuthToken;
            }
            const logs = {
                request: searchRequest,
                response: authToken,
            };
            await this.supplierLogUtility.generateLogFile({
                fileName: (searchRequest?.searchReqId || 'unknown') + '-' + new Date().toISOString().slice(0, 10) + '-auth-TBO',
                logData: logs,
                folderName: 'auth',
                logId: null,
                title: 'Auth-TBO',
                searchReqId: searchRequest?.searchReqId,
                bookingReferenceId: null,
            });
            return authToken;
        }
        catch (error) {
            console.log(error);
            throw new common_1.InternalServerErrorException('There is an issue while fetching data from the providers.');
        }
    }
    async getNewAuthToken(searchRequest) {
        const { providerCred, headers } = searchRequest;
        try {
            const data = {
                ClientId: providerCred.client_id,
                UserName: providerCred.username,
                Password: providerCred.password,
                EndUserIp: headers['ip-address'],
            };
            const endpoint = `${providerCred.auth_url}/rest/Authenticate`;
            console.log("endpoint:::::::::", endpoint);
            const sessionData = await http_utility_1.Http.httpRequestTBO('POST', endpoint, JSON.stringify(data));
            const logs = {
                request: data,
                response: sessionData,
                ApiRequest: searchRequest,
                ApiResponse: sessionData,
            };
            await this.supplierLogUtility.generateLogFile({
                fileName: (searchRequest?.searchReqId || 'unknown') + '-' + new Date().toISOString().slice(0, 10) + '-auth-request-TBO',
                logData: logs,
                folderName: 'auth',
                logId: null,
                title: 'Auth-TBO',
                searchReqId: searchRequest?.searchReqId,
                bookingReferenceId: null,
            });
            if (sessionData.Status == 1 && sessionData.TokenId != '') {
                return sessionData.TokenId;
            }
            else {
                throw new common_1.InternalServerErrorException('There is an issue while fetching data from the providers.');
            }
        }
        catch (error) {
            console.log(error);
            throw new common_1.InternalServerErrorException('There is an issue while fetching data from the providers.');
        }
    }
};
exports.TboAuthTokenService = TboAuthTokenService;
exports.TboAuthTokenService = TboAuthTokenService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [configuration_service_1.ConfigurationService,
        s3bucket_utility_1.s3BucketService,
        supplier_log_utility_1.SupplierLogUtility])
], TboAuthTokenService);
//# sourceMappingURL=tbo-auth-token.service.js.map