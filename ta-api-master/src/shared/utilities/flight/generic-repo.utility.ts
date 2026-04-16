import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import moment from 'moment';
import { ErrorLogs } from 'src/shared/entities/error-logs.entity';

@Injectable()
export class GenericRepo {
    constructor(@InjectRepository(ErrorLogs) private errorLogsRepo: Repository<ErrorLogs>) {}

    /** [@Description: Used to store the logs]
     * @author: Prashant Joshi at 23-09-2025 **/
    async storeLogs(searchReqId: string, logsType: number, data, isEmail: number) {
        const message = {};
        Object.assign(message, { error: data.stack });

        const response = this.errorLogsRepo.create({
            logs_type: logsType,
            searchReqId: searchReqId,
            response: JSON.stringify(message),
            is_email: isEmail,
            date: moment().format('YYYY-MM-DD HH:mm:ss'),
        });

        return await this.errorLogsRepo.save(response);
    }

    /** [@Description: Used to fetch the logs based on time]
     * @author: Prashant Joshi at 23-09-2025 **/
    async getLogsByTime(): Promise<ErrorLogs[]> {
        const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');
        const found = await this.errorLogsRepo.find({
            where: {
                date: LessThanOrEqual(currentTime),
            },
        });

        return found;
    }

    /** [@Description: Used to delete the logs]
     * @author: Prashant Joshi at 23-09-2025 **/
    async deleteLogsByID(logIds) {
        return await this.errorLogsRepo.delete(logIds);
    }
}
