import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { TboAuthTokenService } from "../../providers/tbo/tbo-auth-token.service";
import { Http } from "src/shared/utilities/flight/http.utility";
import { GenericRepo } from "src/shared/utilities/flight/generic-repo.utility";
import { SupplierLogUtility } from "src/shared/utilities/flight/supplier-log.utility";
import { airlines } from "src/shared/utilities/flight/airline.utility";
import { runWithTboInstrumentationAsync } from "src/shared/utilities/flight/tbo-api-instrumentation.utility";
import {
  FareUpsellOptionV2,
  FareUpsellV2Response,
  UpsellInclusionV2,
  UpsellServiceV2,
} from "../interfaces/fare-upsell-v2.interface";
import { TboSearchV11Service } from "./tbo-search-v11.service";
import { istTime, seconds } from "../utils/timing.util";

const PAX_TYPES = { 1: "ADT", 2: "CHD", 3: "INF" };

/**
 * TBO Air FareUpsell V11 (endpoint from env TBO_V11_FAREUPSELL_URL).
 * Returns updated fares + fare family, inclusions and services for up to 10 ResultIndexes.
 * The ResultIndex of the chosen option must be used in FareQuote, SSR, Book, Ticket, GetBookingDetails.
 * Each option is mapped with the V11 search mapping, so it has the same keys as a search route.
 */
@Injectable()
export class TboFareUpsellV11Service {
  constructor(
    private readonly tboAuthTokenService: TboAuthTokenService,
    private readonly tboSearchV11Service: TboSearchV11Service,
    private readonly genericRepo: GenericRepo,
    private readonly supplierLogUtility: SupplierLogUtility,
  ) {}

  /** [@Description: Fare upsell options for the selected ResultIndexes (one TBO call)] **/
  async fareUpsell(fareUpsellRequest): Promise<FareUpsellV2Response> {
    const { searchReqId } = fareUpsellRequest;
    return runWithTboInstrumentationAsync({ searchReqId, phase: "revalidate" }, () =>
      this.fareUpsellInternal(fareUpsellRequest),
    );
  }

  private async fareUpsellInternal(fareUpsellRequest): Promise<FareUpsellV2Response> {
    const { searchReqId, headers, trackingId, solutionIds, apiRequest } = fareUpsellRequest;
    const tag = `[FLIGHT-FAREUPSELL-V11][TIMING] reqId=${searchReqId}`;

    const endpoint = process.env.TBO_V11_FAREUPSELL_URL;
    if (!endpoint) {
      throw new InternalServerErrorException(
        "TBO V11 fare upsell URL is not configured (TBO_V11_FAREUPSELL_URL).",
      );
    }

    const authStart = Date.now();
    const authToken = await this.tboAuthTokenService.getAuthToken(fareUpsellRequest);
    console.log(`${tag} auth token ready at ${istTime(Date.now())} | took ${seconds(Date.now() - authStart)}`);

    const requestBody = {
      EndUserIp: headers["ip-address"],
      TokenId: authToken,
      TraceId: trackingId,
      ResultIndexes: solutionIds,
    };

    let supplierResponse;
    let response: FareUpsellV2Response | undefined;
    const startTime = Date.now();
    let endTime = startTime;

    try {
      console.log(`${tag} TBO V11 FareUpsell call started at ${istTime(startTime)} | ResultIndexes ${solutionIds.length} | endpoint: ${endpoint}`);
      supplierResponse = await Http.httpRequestTBO(
        "POST",
        endpoint,
        JSON.stringify(requestBody),
        "revalidate",
      );
      endTime = Date.now();
      console.log(
        `${tag} TBO V11 FareUpsell responded at ${istTime(endTime)} | TBO took ${seconds(endTime - startTime)} (started ${istTime(startTime)})`,
      );

      response = this.convertingResponse(fareUpsellRequest, supplierResponse);
      console.log(`${tag} conversion done at ${istTime(Date.now())} | options ${response.options.length}`);

      return response;
    } catch (error) {
      await this.genericRepo.storeLogs(searchReqId, 1, error, 0);
      console.log(error);
      throw new InternalServerErrorException(
        "There is an issue while fetching data from the providers.",
      );
    } finally {
      /* Full log (our request, TBO request, complete raw TBO response, our response).
         Not awaited so the upload doesn't delay the response */
      const logsWithRes = {
        ApiRequest: apiRequest,
        ApiResponse: response ?? null,
        ApiResponseTime: `${(Date.now() - startTime) / 1000} seconds`,
        supplierEndpoint: endpoint,
        supplierRequest: requestBody,
        supplierResponse: supplierResponse ?? null,
        supplierResponseTime: `${(endTime - startTime) / 1000} seconds`,
      };
      this.supplierLogUtility
        .generateLogFile({
          fileName: searchReqId + "-" + Date.now() + "-TBO-V11",
          logData: logsWithRes,
          folderName: "fareupsell-v11",
          logId: null,
          title: "FareUpsell-TBO-V11",
          searchReqId: searchReqId,
          bookingReferenceId: null,
        })
        .catch((error) => this.genericRepo.storeLogs(searchReqId, 1, error, 0));
    }
  }

  /** [@Description: TBO response -> our response. Body may come wrapped in Response or at top level] **/
  convertingResponse(fareUpsellRequest, supplierResponse): FareUpsellV2Response {
    const { searchReqId, trackingId, providerCred, headers } = fareUpsellRequest;
    const body =
      supplierResponse?.Response && typeof supplierResponse.Response === "object"
        ? supplierResponse.Response
        : supplierResponse;

    const response = new FareUpsellV2Response();
    response.searchReqId = searchReqId;
    response.trackingId = body?.TraceId || trackingId;
    response.mode = "TBO-" + providerCred?.mode;

    const results = Array.isArray(body?.Results) ? body.Results.flat() : [];
    if (body?.ResponseStatus === 1 && results.length > 0) {
      const preferredCurrency = headers?.["currency-preference"] || "USD";
      const airlineNames = airlines("");
      response.options = results.map((result) =>
        this.convertOption(result, preferredCurrency, airlineNames),
      );
      response.error = false;
      response.message = "OK";
    } else {
      response.options = [];
      response.error = true;
      response.message =
        body?.Error?.ErrorMessage ||
        (Array.isArray(supplierResponse) ? "No response from TBO V11 FareUpsell (HTTP error)." : "No upsell found.");
    }
    response.count = response.options.length;

    /* TBO passthrough: every top-level key (ResponseStatus, Error, TraceId, ResultCount, ...) */
    if (body && typeof body === "object" && !Array.isArray(body)) {
      Object.entries(body).forEach(([key, value]) => {
        if (key !== "Results" && response[key] === undefined) response[key] = value;
      });
    }

    return response;
  }

  /** [@Description: One TBO upsell result -> one fare option (search route format + upsell details)] **/
  convertOption(result, preferredCurrency, airlineNames): FareUpsellOptionV2 {
    const journeyDirection = /^IB/i.test(String(result?.ResultIndex ?? "")) ? "inbound" : "outbound";
    const searchReq = this.paxFromFareBreakdown(result?.FareBreakdown);

    const route = this.tboSearchV11Service.convertJourney(
      result,
      journeyDirection,
      searchReq,
      preferredCurrency,
      airlineNames,
    );
    const option = route as FareUpsellOptionV2;

    const upsellList = Array.isArray(result?.UpsellOptionsList?.UpsellList)
      ? result.UpsellOptionsList.UpsellList
      : [];
    const firstSegment = [result?.Segments ?? []].flat(2)[0];

    option.isUpsellAvailable = upsellList.length > 0;
    option.fareFamily = {
      code: upsellList[0]?.FareFamilyCode ?? "",
      name: upsellList[0]?.FareFamilyName || firstSegment?.SupplierFareClass || "",
    };
    option.upsellInclusions = this.formatInclusions(result?.Inclusions);
    option.upsellServices = this.formatServices(upsellList);

    return option;
  }

  /** [@Description: Pax counts from TBO FareBreakdown (PassengerType 1/2/3 + PassengerCount),
   * in the search request shape the V11 price mapping uses] **/
  paxFromFareBreakdown(fareBreakdown) {
    const count = (type: number) =>
      (Array.isArray(fareBreakdown) ? fareBreakdown : [])
        .filter((item) => item?.PassengerType === type)
        .reduce((sum, item) => sum + (Number(item?.PassengerCount) || 0), 0);
    return {
      paxes: [
        { type: "ADT", quantity: count(1) },
        { type: "CHD", quantity: count(2) },
        { type: "INF", quantity: count(3) },
      ],
    };
  }

  /** [@Description: TBO Inclusions[] { Key, FreeText, IsPaid, Price, Currency } -> list] **/
  formatInclusions(inclusions): UpsellInclusionV2[] {
    if (!Array.isArray(inclusions)) return [];
    return inclusions.map((item) => ({
      key: String(item?.Key ?? ""),
      label: String(item?.FreeText ?? item?.Key ?? ""),
      status: item?.IsPaid ? "chargeable" : "included",
      isPaid: Boolean(item?.IsPaid),
      price: typeof item?.Price === "number" ? item.Price : null,
      currency: item?.Currency ?? "",
    }));
  }

  /** [@Description: UpsellList[].ServicesList[] -> list (one row per service per flight / pax type).
   * IsIncluded / IsChargeable come as "Yes" / "No"] **/
  formatServices(upsellList): UpsellServiceV2[] {
    const yes = (value) => String(value ?? "").trim().toLowerCase() === "yes" || value === true;
    return upsellList.flatMap((upsell) =>
      (Array.isArray(upsell?.ServicesList) ? upsell.ServicesList : []).map((service) => {
        const isIncluded = yes(service?.IsIncluded);
        const isChargeable = yes(service?.IsChargeable);
        return {
          code: service?.Code ?? "",
          description: service?.UpsellDescription ?? "",
          serviceType: service?.ServiceType ?? "",
          ssrCode: service?.SSRCode ?? "",
          status: isIncluded ? "included" : isChargeable ? "chargeable" : "not_included",
          isIncluded,
          isChargeable,
          flightInfoIndex: String(upsell?.FlightInfoIndex ?? ""),
          paxType: PAX_TYPES[upsell?.PassengerType] ?? String(upsell?.PassengerType ?? ""),
        };
      }),
    );
  }
}
