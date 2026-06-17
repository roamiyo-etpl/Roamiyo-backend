import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SsrResponseCacheEntity } from 'src/shared/entities/ssr-response-cache.entity';

const SSR_CACHE_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class SsrCacheService {
  constructor(
    @InjectRepository(SsrResponseCacheEntity)
    private readonly ssrCacheRepo: Repository<SsrResponseCacheEntity>,
  ) {}

  async saveSsrResponse(params: {
    traceId: string;
    resultIndex: string;
    response: unknown;
    providerCode?: string;
  }): Promise<void> {
    const { traceId, resultIndex, response, providerCode = 'TBO' } = params;
    if (!traceId || !resultIndex) return;

    await this.ssrCacheRepo.save({
      trace_id: traceId,
      result_index: resultIndex,
      response: JSON.stringify(response),
      provider_code: providerCode,
    });
  }

  async getFreshSsrResponse(params: {
    traceId: string;
    resultIndex: string;
    providerCode?: string;
  }): Promise<unknown | null> {
    const { traceId, resultIndex, providerCode = 'TBO' } = params;
    if (!traceId || !resultIndex) return null;

    const row = await this.ssrCacheRepo.findOne({
      where: {
        trace_id: traceId,
        result_index: resultIndex,
        provider_code: providerCode,
      },
      order: { created_at: 'DESC' },
    });

    if (!row) return null;

    const ageMs = Date.now() - new Date(row.created_at).getTime();
    if (ageMs > SSR_CACHE_TTL_MS) return null;

    try {
      return JSON.parse(row.response);
    } catch {
      return null;
    }
  }
}
