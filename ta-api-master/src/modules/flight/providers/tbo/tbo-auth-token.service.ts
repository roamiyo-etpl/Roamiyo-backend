import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigurationService } from "../../configuration/configuration.service";
import { s3BucketService } from "src/shared/utilities/flight/s3bucket.utility";
import { Http } from "src/shared/utilities/flight/http.utility";
import { SupplierLogUtility } from "src/shared/utilities/flight/supplier-log.utility";
import {
  redactTboCredentialsForLog,
  resolveTboEndUserIp,
} from "src/shared/utilities/flight/tbo-request-context.utility";

@Injectable()
export class TboAuthTokenService {
  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly s3BucketService: s3BucketService,
    private readonly supplierLogUtility: SupplierLogUtility,
  ) {}

  /** [@Description: This method is used to get the auth token]
   * @author: Prashant Joshi at 13-10-2025 **/
  async getAuthToken(searchRequest) {
    try {
      const authToken = await this.configurationService.getToken({
        searchRequest,
        module: "Flight",
      });
      if (authToken == "undefined" || authToken == null || authToken == "") {
        const newAuthToken = await this.getNewAuthToken(searchRequest);
        await this.configurationService.updateAuthToken({
          newAuthToken,
          searchRequest,
          module: "Flight",
        });
        return newAuthToken;
      }
      // Save auth logs to S3
      // await this.s3BucketService.generateS3LogFile((searchRequest?.searchReqId || 'unknown') + '-' + new Date().toISOString().slice(0, 10) + '-auth-TBO', logs, 'auth');
      // await this.supplierLogUtility.generateLogFile({
      //     fileName: (searchRequest?.searchReqId || 'unknown') + '-' + new Date().toISOString().slice(0, 10) + '-auth-TBO',
      //     logData: logs,
      //     folderName: 'auth',
      //     logId: null,
      //     title: 'Auth-TBO',
      //     searchReqId: searchRequest?.searchReqId,
      //     bookingReferenceId: null,
      // });
      if (process.env.ENABLE_LOCAL_LOGS === "false") {
        const safeLogs = {
          request: {
            ...searchRequest,
            providerCred: redactTboCredentialsForLog(
              searchRequest?.providerCred as Record<string, unknown>,
            ),
          },
          response: authToken,
        };
        await this.supplierLogUtility.generateLogFile({
          fileName:
            (searchRequest?.searchReqId || "unknown") +
            "-" +
            new Date().toISOString().slice(0, 10) +
            "-auth-TBO",
          logData: safeLogs,
          folderName: "auth",
          logId: null,
          title: "Auth-TBO",
          searchReqId: searchRequest?.searchReqId,
          bookingReferenceId: null,
        });
      }
      return authToken;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        "There is an issue while fetching data from the providers.",
      );
    }
  }

  /** [@Description: This method is used to get the new auth token]
   * @author: Prashant Joshi at 13-10-2025 **/
  async getNewAuthToken(searchRequest) {
    const { providerCred, headers } = searchRequest;
    try {
      const data = {
        ClientId: providerCred.client_id,
        UserName: providerCred.username,
        Password: providerCred.password,
        EndUserIp: resolveTboEndUserIp(headers as Record<string, unknown>),
      };
      // dev endpoint
      const endpoint = `${providerCred.auth_url}/SharedData.svc/rest/Authenticate`;

      // prod endpoint is
      // const endpoint = `${providerCred.auth_url}/rest/Authenticate`;
      console.log("endpoint:::::::::", endpoint);

      const sessionData = await Http.httpRequestTBO(
        "POST",
        endpoint,
        JSON.stringify(data),
      );
      const logs = {
        request: { ...data, Password: "[REDACTED]" },
        response: sessionData,
        ApiRequest: {
          ...searchRequest,
          providerCred: redactTboCredentialsForLog(
            searchRequest?.providerCred as Record<string, unknown>,
          ),
        },
        ApiResponse: sessionData,
      };
      // Log auth request to S3
      // await this.s3BucketService.generateS3LogFile((searchRequest?.searchReqId || 'unknown') + '-' + new Date().toISOString().slice(0, 10) + '-auth-request-TBO', logs, 'auth');
      await this.supplierLogUtility.generateLogFile({
        fileName:
          (searchRequest?.searchReqId || "unknown") +
          "-" +
          new Date().toISOString().slice(0, 10) +
          "-auth-request-TBO",
        logData: logs,
        folderName: "auth",
        logId: null,
        title: "Auth-TBO",
        searchReqId: searchRequest?.searchReqId,
        bookingReferenceId: null,
      });
      if (sessionData.Status == 1 && sessionData.TokenId != "") {
        return sessionData.TokenId;
      } else {
        throw new InternalServerErrorException(
          "There is an issue while fetching data from the providers.",
        );
      }
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        "There is an issue while fetching data from the providers.",
      );
    }
  }
}
