import { AsyncLocalStorage } from 'async_hooks';
import { Logger } from '@nestjs/common';

export type TboCallPhase =
  | 'revalidate'
  | 'initiate'
  | 'confirm'
  | 'ssr'
  | 'search'
  | 'auth'
  | 'orderDetail'
  | 'cancel'
  | 'other';

export interface TboApiCallRecord {
  endpoint: string;
  phase: TboCallPhase;
  at: string;
  success?: boolean;
  durationMs?: number;
}

interface TboInstrumentationStore {
  searchReqId?: string;
  phase?: TboCallPhase;
  calls: TboApiCallRecord[];
}

const logger = new Logger('FlightTBO');
const storage = new AsyncLocalStorage<TboInstrumentationStore>();

export function runWithTboInstrumentation<T>(
  context: { searchReqId?: string; phase?: TboCallPhase },
  fn: () => T,
): T {
  return storage.run(
    {
      searchReqId: context.searchReqId,
      phase: context.phase,
      calls: [],
    },
    fn,
  );
}

export async function runWithTboInstrumentationAsync<T>(
  context: { searchReqId?: string; phase?: TboCallPhase },
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(
    {
      searchReqId: context.searchReqId,
      phase: context.phase,
      calls: [],
    },
    fn,
  );
}

export function extractTboEndpointName(url: string): string {
  const normalized = url.split('?')[0];
  const parts = normalized.split('/');
  const last = parts[parts.length - 1] || normalized;
  return last;
}

export function tryExtractTraceIdFromPayload(
  data: unknown,
): string | undefined {
  if (data == null) return undefined;
  try {
    const parsed =
      typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown>);
    const traceId = parsed?.TraceId ?? parsed?.traceId;
    return traceId != null ? String(traceId) : undefined;
  } catch {
    return undefined;
  }
}

export function classifyTboApiOutcome(body: unknown): {
  success: boolean;
  responseStatus?: number;
  message?: string;
} {
  if (body == null) {
    return { success: false, message: 'Empty response' };
  }
  if (Array.isArray(body) && body.length === 0) {
    return { success: false, message: 'HTTP or network failure (empty body)' };
  }

  const root = body as Record<string, unknown>;

  if (typeof root.Status === 'number') {
    const ok = root.Status === 1;
    return {
      success: ok,
      responseStatus: root.Status,
      message: ok
        ? undefined
        : String(root.Error ?? root.ErrorDescription ?? 'Authenticate failed'),
    };
  }

  const response = root.Response as Record<string, unknown> | undefined;
  if (response && typeof response.ResponseStatus === 'number') {
    const ok = response.ResponseStatus === 1;
    const nested = response.Response as Record<string, unknown> | undefined;
    const errMsg =
      (response.Error as { ErrorMessage?: string } | undefined)?.ErrorMessage ??
      (nested?.Error as { ErrorMessage?: string } | undefined)?.ErrorMessage ??
      (root.Errors as { UserMessage?: string }[] | undefined)?.[0]
        ?.UserMessage;
    return {
      success: ok,
      responseStatus: response.ResponseStatus,
      message: ok ? undefined : String(errMsg ?? 'TBO supplier error'),
    };
  }

  return { success: true, message: 'Response received (non-standard shape)' };
}

export interface TboApiLogContext {
  apiName: string;
  phase?: TboCallPhase;
  traceId?: string;
  searchReqId?: string;
  method?: string;
}

function resolveSearchReqId(explicit?: string): string {
  if (explicit) return explicit;
  return storage.getStore()?.searchReqId ?? 'n/a';
}

function resolvePhase(explicit?: TboCallPhase): TboCallPhase {
  if (explicit) return explicit;
  return storage.getStore()?.phase ?? 'other';
}

/** Log before a flight TBO HTTP call (always written to server logs). */
export function logTboApiCallStart(ctx: TboApiLogContext): void {
  const phase = resolvePhase(ctx.phase);
  const searchReqId = resolveSearchReqId(ctx.searchReqId);
  const store = storage.getStore();
  if (store) {
    store.calls.push({
      endpoint: ctx.apiName,
      phase,
      at: new Date().toISOString(),
    });
  }

  const parts = [
    `START api=${ctx.apiName}`,
    `phase=${phase}`,
    `searchReqId=${searchReqId}`,
    ctx.method ? `method=${ctx.method}` : null,
    ctx.traceId ? `traceId=${ctx.traceId}` : null,
  ].filter(Boolean);

  logger.log(parts.join(' '));
}

/** Log after a flight TBO HTTP call completes (always written to server logs). */
export function logTboApiCallEnd(
  ctx: TboApiLogContext & {
    durationMs: number;
    success: boolean;
    responseStatus?: number;
    message?: string;
    httpStatus?: number;
  },
): void {
  const phase = resolvePhase(ctx.phase);
  const searchReqId = resolveSearchReqId(ctx.searchReqId);
  const store = storage.getStore();
  const last = store?.calls[store.calls.length - 1];
  if (last && last.endpoint === ctx.apiName) {
    last.success = ctx.success;
    last.durationMs = ctx.durationMs;
  }

  const status = ctx.success ? 'SUCCESS' : 'FAILED';
  const parts = [
    `END api=${ctx.apiName}`,
    `status=${status}`,
    `phase=${phase}`,
    `searchReqId=${searchReqId}`,
    `durationMs=${ctx.durationMs}`,
    ctx.responseStatus != null ? `responseStatus=${ctx.responseStatus}` : null,
    ctx.httpStatus != null ? `httpStatus=${ctx.httpStatus}` : null,
    ctx.traceId ? `traceId=${ctx.traceId}` : null,
    !ctx.success && ctx.message ? `error="${ctx.message.replace(/"/g, "'")}"` : null,
  ].filter(Boolean);

  if (ctx.success) {
    logger.log(parts.join(' '));
  } else {
    logger.warn(parts.join(' '));
  }
}

/** Log when a TBO call is intentionally skipped (cache hit, no ancillaries, etc.). */
export function logTboApiCallSkipped(ctx: {
  apiName: string;
  phase?: TboCallPhase;
  reason: string;
  searchReqId?: string;
  traceId?: string;
}): void {
  const phase = resolvePhase(ctx.phase);
  const searchReqId = resolveSearchReqId(ctx.searchReqId);
  const parts = [
    `SKIP api=${ctx.apiName}`,
    `phase=${phase}`,
    `searchReqId=${searchReqId}`,
    `reason=${ctx.reason}`,
    ctx.traceId ? `traceId=${ctx.traceId}` : null,
  ].filter(Boolean);
  logger.log(parts.join(' '));
}

/** @deprecated Use logTboApiCallStart — kept for backward compatibility */
export function recordTboApiCall(
  endpoint: string,
  phase: TboCallPhase = 'other',
): void {
  logTboApiCallStart({ apiName: endpoint, phase });
}

export function getTboCallSummary():
  | { searchReqId?: string; count: number; calls: TboApiCallRecord[] }
  | null {
  const store = storage.getStore();
  if (!store) return null;
  return {
    searchReqId: store.searchReqId,
    count: store.calls.length,
    calls: [...store.calls],
  };
}
