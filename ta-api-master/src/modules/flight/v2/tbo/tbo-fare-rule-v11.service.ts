import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { TboAuthTokenService } from "../../providers/tbo/tbo-auth-token.service";
import { Http } from "src/shared/utilities/flight/http.utility";
import { GenericRepo } from "src/shared/utilities/flight/generic-repo.utility";
import { SupplierLogUtility } from "src/shared/utilities/flight/supplier-log.utility";
import { runWithTboInstrumentationAsync } from "src/shared/utilities/flight/tbo-api-instrumentation.utility";
import {
  FareRuleV2Response,
  FareRuleV2Result,
  MiniFareRuleV2,
} from "../interfaces/fare-rule-v2.interface";
import { istTime, seconds } from "../utils/timing.util";

const PAX_TYPES = { 1: "ADT", 2: "CHD", 3: "INF" };
const RULE_TYPES = { 0: "Cancellation", 1: "Reissue" };

/**
 * TBO Air FareRule V11 (endpoint from env TBO_V11_FARERULE_URL).
 * V11 returns FareRules + MiniFareRules only here (no longer in Search).
 * Independent of the V10 revalidate FareRule call: V10 code is not used or changed here.
 */
@Injectable()
export class TboFareRuleV11Service {
  constructor(
    private readonly tboAuthTokenService: TboAuthTokenService,
    private readonly genericRepo: GenericRepo,
    private readonly supplierLogUtility: SupplierLogUtility,
  ) {}

  /** [@Description: Fare rules for one or more ResultIndexes (one TBO call each, in parallel)] **/
  async fareRule(fareRuleRequest): Promise<FareRuleV2Response> {
    const { searchReqId } = fareRuleRequest;
    return runWithTboInstrumentationAsync({ searchReqId, phase: "revalidate" }, () =>
      this.fareRuleInternal(fareRuleRequest),
    );
  }

  private async fareRuleInternal(fareRuleRequest): Promise<FareRuleV2Response> {
    const { searchReqId, providerCred, trackingId, solutionIds } = fareRuleRequest;
    const tag = `[FLIGHT-FARERULE-V11][TIMING] reqId=${searchReqId}`;

    const endpoint = process.env.TBO_V11_FARERULE_URL;
    if (!endpoint) {
      throw new InternalServerErrorException(
        "TBO V11 fare rule URL is not configured (TBO_V11_FARERULE_URL).",
      );
    }

    const authStart = Date.now();
    const authToken = await this.tboAuthTokenService.getAuthToken(fareRuleRequest);
    console.log(`${tag} auth token ready at ${istTime(Date.now())} | took ${seconds(Date.now() - authStart)}`);

    const results: FareRuleV2Result[] = await Promise.all(
      solutionIds.map((solutionId: string, index: number) =>
        this.callFareRule({
          fareRuleRequest,
          endpoint,
          authToken,
          solutionId,
          journeyDirection: index === 0 ? "outbound" : "inbound",
          tag,
        }),
      ),
    );

    const response = new FareRuleV2Response();
    response.searchReqId = searchReqId;
    response.trackingId = trackingId;
    response.mode = "TBO-" + providerCred?.mode;
    response.results = results;
    response.miniFareRules = results.flatMap((result) => result.miniFareRules);
    response.fareRules = results.flatMap((result) =>
      Array.isArray(result.FareRules) ? result.FareRules : [],
    );
    response.error = results.every((result) => result.error);
    response.message = response.error
      ? results.find((result) => result.message)?.message || "No fare rule found."
      : "OK";

    return response;
  }

  /** [@Description: One TBO FareRule call + full supplier log] **/
  private async callFareRule({
    fareRuleRequest,
    endpoint,
    authToken,
    solutionId,
    journeyDirection,
    tag,
  }): Promise<FareRuleV2Result> {
    const { searchReqId, headers, trackingId, apiRequest } = fareRuleRequest;
    const requestBody = {
      EndUserIp: headers["ip-address"],
      TokenId: authToken,
      TraceId: trackingId,
      ResultIndex: solutionId,
    };

    let supplierResponse;
    let result: FareRuleV2Result | undefined;
    const startTime = Date.now();
    let endTime = startTime;

    try {
      console.log(`${tag} TBO V11 FareRule (${journeyDirection}) call started at ${istTime(startTime)} | endpoint: ${endpoint}`);
      supplierResponse = await Http.httpRequestTBO(
        "POST",
        endpoint,
        JSON.stringify(requestBody),
        "revalidate",
      );
      endTime = Date.now();
      console.log(
        `${tag} TBO V11 FareRule (${journeyDirection}) responded at ${istTime(endTime)} | TBO took ${seconds(endTime - startTime)} (started ${istTime(startTime)})`,
      );

      result = this.convertingResponse(supplierResponse, solutionId, journeyDirection);
      return result;
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
        ApiResponse: result ?? null,
        ApiResponseTime: `${(Date.now() - startTime) / 1000} seconds`,
        supplierEndpoint: endpoint,
        supplierRequest: requestBody,
        supplierResponse: supplierResponse ?? null,
        supplierResponseTime: `${(endTime - startTime) / 1000} seconds`,
      };
      this.supplierLogUtility
        .generateLogFile({
          fileName: searchReqId + "-" + journeyDirection + "-" + Date.now() + "-TBO-V11",
          logData: logsWithRes,
          folderName: "farerule-v11",
          logId: null,
          title: "FareRule-TBO-V11",
          searchReqId: searchReqId,
          bookingReferenceId: null,
        })
        .catch((error) => this.genericRepo.storeLogs(searchReqId, 1, error, 0));
    }
  }

  /** [@Description: TBO response -> our result. V11 sends the body at top level; V10 wraps it in Response] **/
  convertingResponse(supplierResponse, solutionId: string, journeyDirection): FareRuleV2Result {
    const body =
      supplierResponse?.Response && typeof supplierResponse.Response === "object"
        ? supplierResponse.Response
        : supplierResponse;

    const result = new FareRuleV2Result();
    result.journeyDirection = journeyDirection;
    result.solutionId = solutionId;

    const fareRules = Array.isArray(body?.FareRules) ? body.FareRules : [];
    if (body?.ResponseStatus === 1 && fareRules.length > 0) {
      result.error = false;
      result.message = "OK";
      result.miniFareRules = fareRules.flatMap((fareRule) =>
        this.formatMiniFareRules(fareRule, solutionId, journeyDirection),
      );
    } else {
      result.error = true;
      result.message =
        body?.Error?.ErrorMessage ||
        (Array.isArray(supplierResponse) ? "No response from TBO V11 FareRule (HTTP error)." : "No fare rule found.");
      result.miniFareRules = [];
    }

    /* TBO passthrough: every response key (FareRules, ResponseStatus, TraceId, Error, NonRefundable, ...) */
    if (body && typeof body === "object" && !Array.isArray(body)) {
      Object.entries(body).forEach(([key, value]) => {
        if (result[key] === undefined) result[key] = value;
      });
    }

    return result;
  }

  /** [@Description: Flattens one FareRules item's MiniFareRules into rows (one per rule per pax type).
   * V11: { Currency, Rules: [{ DepartureType, FromDuration, ToDuration, Type, PaxPenalties[] }] }.
   * Old V10 shape (array of arrays with Type/From/To/Unit/Details) is handled too] **/
  formatMiniFareRules(fareRule, solutionId: string, journeyDirection): MiniFareRuleV2[] {
    const mini = fareRule?.MiniFareRules;
    if (!mini) return [];

    const base = {
      journeyDirection,
      solutionId,
      origin: fareRule?.Origin ?? "",
      destination: fareRule?.Destination ?? "",
      airline: fareRule?.Airline ?? "",
      fareBasisCode: fareRule?.FareBasisCode ?? "",
    };

    /* V11 shape */
    if (Array.isArray(mini?.Rules)) {
      return mini.Rules.flatMap((rule) => {
        const fromHours = this.timeSpanToHours(rule?.FromDuration);
        const toHours = this.timeSpanToHours(rule?.ToDuration);
        const penalties =
          Array.isArray(rule?.PaxPenalties) && rule.PaxPenalties.length
            ? rule.PaxPenalties
            : [{}];

        return penalties.map((penalty) => ({
          ...base,
          type: RULE_TYPES[rule?.Type] ?? String(rule?.Type ?? ""),
          typeCode: rule?.Type ?? "",
          departureType: rule?.DepartureType ?? "",
          fromDuration: rule?.FromDuration ?? "",
          toDuration: rule?.ToDuration ?? "",
          fromHours,
          toHours,
          window: this.windowLabel(fromHours, toHours),
          paxType: PAX_TYPES[penalty?.PassengerType] ?? String(penalty?.PassengerType ?? ""),
          airlineFee: typeof penalty?.AirlineFee === "number" ? penalty.AirlineFee : null,
          currency: penalty?.Currency ?? mini?.Currency ?? "",
        }));
      });
    }

    /* Old V10 shape */
    if (Array.isArray(mini)) {
      return mini.flat().map((rule) => {
        const amount = String(rule?.Details ?? "").match(/([A-Z]{3})?\s*([\d.,]+)/);
        const unit = rule?.Unit ? ` ${rule.Unit}` : "";
        return {
          ...base,
          origin: base.origin || String(rule?.JourneyPoints ?? "").split("-")[0] || "",
          destination: base.destination || String(rule?.JourneyPoints ?? "").split("-")[1] || "",
          type: rule?.Type ?? "",
          typeCode: rule?.Type ?? "",
          departureType: "",
          fromDuration: `${rule?.From ?? ""}${unit}`.trim(),
          toDuration: `${rule?.To ?? ""}${unit}`.trim(),
          fromHours: null,
          toHours: null,
          window: [rule?.From, rule?.To].every((v) => v != null && v !== "")
            ? `${rule.From} to ${rule.To}${unit}`
            : "",
          paxType: "",
          airlineFee: amount ? Number(amount[2].replace(/,/g, "")) : null,
          currency: amount?.[1] ?? "",
        };
      });
    }

    return [];
  }

  /** [@Description: TBO timespan "d.hh:mm:ss" or "hh:mm:ss" -> hours] **/
  timeSpanToHours(value): number | null {
    const match = String(value ?? "").match(/^(?:(\d+)\.)?(\d+):(\d+)(?::(\d+))?$/);
    if (!match) return null;
    const [, days, hours, minutes] = match;
    return Number(days || 0) * 24 + Number(hours) + Number(minutes) / 60;
  }

  /** [@Description: e.g. 4, 330 -> "4h to 13d 18h"] **/
  windowLabel(fromHours: number | null, toHours: number | null): string {
    if (fromHours == null || toHours == null) return "";
    const label = (h: number) => {
      const days = Math.floor(h / 24);
      const rest = Math.round((h % 24) * 100) / 100;
      return [days ? `${days}d` : "", rest || !days ? `${rest}h` : ""].filter(Boolean).join(" ");
    };
    return `${label(fromHours)} to ${label(toHours)}`;
  }
}
