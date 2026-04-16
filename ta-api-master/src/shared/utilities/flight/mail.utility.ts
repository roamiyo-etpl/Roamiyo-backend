import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import moment from 'moment';
import { SendEmailModel } from 'src/shared/model/email.model';

@Injectable()
export class MailService {
    constructor(private mailService: MailerService) {}

    /** [@Description: Generic method to use mail function]
     * @author: Prashant Joshi at 23-09-2025 **/
    async sendMail(emailData: SendEmailModel) {
        /* Setting Up current Year */
        Object.assign(emailData.data, {
            year: moment().year(),
        });

        await this.mailService.sendMail({
            to: emailData.mailTo,
            bcc: emailData.bcc,
            // from: 'member@traveladvantage.com',
            subject: emailData.subject,
            template: emailData.template,
            context: {
                emailData: emailData.data,
            },
        });
    }
}
