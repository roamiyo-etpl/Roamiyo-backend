import moment from 'moment';
import momentTZ from 'moment-timezone';

export class DateUtility {
    /** [@Description: Used to get current date time in IST]
     * @author: Prashant Joshi at 08-10-2025 **/
    public static currentDateTimeIST(): string {
        return momentTZ.tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss z');
    }

    /** [@Description: Used to get current date in IST]
     * @author: Prashant Joshi at 08-10-2025 **/
    public static currentDateOnlyIST(): string {
        return momentTZ.tz('Asia/Kolkata').format('YYYY-MM-DD z');
    }

    /** [@Description: Used to convert date to YMD]
     * @author: Prashant Joshi at 08-10-2025 **/
    public static convertDateIntoYMD(date): string {
        return moment(date).format('YYYY-MM-DD');
    }

    /** [@Description: Used to convert date to HMA]
     * @author: Prashant Joshi at 08-10-2025 **/
    public static getTimeFromDateInHMA(date): string {
        return moment(date).format('hh:mm A');
    }

    /** [@Description: Used to convert minutes into hours and minute string. EX: 10 h 20 m]
     * @author: Prashant Joshi at 08-10-2025 **/
    public static convertMinutesIntoHoursMinutes(minutes): string {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }

    static toISOString(date?: Date | string): string {
        return moment(date).toISOString();
    }
}
