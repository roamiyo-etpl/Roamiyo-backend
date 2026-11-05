import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Fare rule v2 request. Only trackingId + solutionId are needed, so the aggregator can send
 * the same payload it sends to /flight/revalidate (other keys are ignored).
 */
export class FareRuleV2Dto {
    @ApiProperty({
        description:
            'ResultIndex from search. One value, "OB ||| IB" (same as revalidate) or ["OB", "IB"] for domestic return. Max 10.',
        example: 'OB1[TBO]...',
    })
    @IsNotEmpty()
    solutionId: string | string[];

    @ApiProperty({
        description: 'trackingId (TBO TraceId) received in search result.',
        example: 'bdd3ff73-5ee7-49fc-bafa-34ba0666bfb7',
    })
    @IsNotEmpty()
    @IsString()
    trackingId: string;

    @ApiPropertyOptional({
        description: 'Search request ID (used to link supplier logs to the search).',
        example: 'efc080e1-3989-427d-abd4-edc7c04d27ab',
    })
    @IsOptional()
    @IsString()
    searchReqId?: string;
}
