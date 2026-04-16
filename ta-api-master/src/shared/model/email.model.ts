export class SendEmailModel {
    subject: string;
    mailTo: string[];
    bcc: string[];
    template: string;
    data: any;
}
