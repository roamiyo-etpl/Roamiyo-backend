import { FareRuleV2Dto } from './fare-rule-v2.dto';

/**
 * Fare upsell v2 request: same fields as fare rule v2 (trackingId + solutionId, optional searchReqId).
 * Send all search solutionIds of the selected flight (its fare types), max 10.
 */
export class FareUpsellV2Dto extends FareRuleV2Dto {}
