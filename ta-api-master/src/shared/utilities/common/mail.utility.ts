import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendEmailModel } from 'src/shared/model/email.model';

@Injectable()
export class MailUtility {
    constructor(
        private readonly mailerService: MailerService,
        private readonly configService: ConfigService,
    ) {}

    /** [@Description: Send email]
     * @author: Prashant Joshi at 25-09-2025 **/
    async sendEmail(SendEmailModel: SendEmailModel): Promise<void> {
        try {
            await this.mailerService.sendMail({
                from: this.configService.get('email.from'),
                to: SendEmailModel.mailTo,
                subject: SendEmailModel.subject,
                template: SendEmailModel.template,
                context: SendEmailModel.data,
            });
        } catch (error: any) {
            throw new InternalServerErrorException(error);
        }
    }
}
