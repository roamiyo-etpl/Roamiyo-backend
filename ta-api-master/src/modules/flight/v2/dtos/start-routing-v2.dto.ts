import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { StartRoutingDto } from '../../search/dtos/start-routing.dto';

/** TBO V11 ResultFareType: 2 Regular, 3 Student, 4 Armed Force, 5 Senior Citizen */
export const TBO_RESULT_FARE_TYPES = [2, 3, 4, 5];

/** Same payload as v1 search (StartRoutingDto) + optional ResultFareType */
export class StartRoutingV2Dto extends StartRoutingDto {
    @ApiPropertyOptional({
        description:
            'TBO fare type: 2 Regular, 3 Student (SG, I5, GDS), 4 Armed Force, 5 Senior Citizen (6E, SG). Omit for regular fares.',
        example: 2,
        enum: TBO_RESULT_FARE_TYPES,
    })
    @IsOptional()
    @Type(() => Number)
    @IsIn(TBO_RESULT_FARE_TYPES)
    ResultFareType?: number;
}
