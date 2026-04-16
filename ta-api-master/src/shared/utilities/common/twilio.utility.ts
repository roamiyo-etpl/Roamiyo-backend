import axios, { AxiosRequestConfig } from 'axios';

export interface TwilioVerificationResult {
    status: boolean;
    data: any;
}

export class TwilioUtility {

    static async verifyPhoneNumber(
        phoneNumber: string,
        accountSid: string,
        authToken: string,
    ): Promise<TwilioVerificationResult> {
        try {
            // Generate Base64 encoded authentication string
            const authString = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

            // Configure axios request
            const config: AxiosRequestConfig = {
                method: 'GET',
                url: `https://lookups.twilio.com/v2/PhoneNumbers/${phoneNumber}`,
                headers: {
                    Authorization: `Basic ${authString}`,
                },
                timeout: 30000, // 30 seconds timeout
            };

            // Make API request
            const response = await axios(config);

            // Validate response
            if (response.data && response.data.valid === true) {
                return {
                    status: true,
                    data: response.data,
                };
            } else {
                return {
                    status: false,
                    data: response.data,
                };
            }
        } catch (error) {
            // Handle errors
            if (axios.isAxiosError(error) && error.response) {
                return {
                    status: false,
                    data: error.response.data,
                };
            }

            return {
                status: false,
                data: {
                    error: error.message || 'Phone verification failed',
                },
            };
        }
    }

    static async phoneNumberVerifyApiCheck(
        phoneNumber: string,
        isActive: boolean,
        accountSid: string,
        authToken: string,
    ): Promise<TwilioVerificationResult> {
        if (isActive) {
            const verifyResult = await this.verifyPhoneNumber(phoneNumber, accountSid, authToken);

            if (!verifyResult.status) {
                return {
                    status: false,
                    data: {
                        message: 'Phone verification failed',
                        error_data: verifyResult.data,
                    },
                };
            }
            return verifyResult;
        } else {
            // Twilio is not active, skip verification
            return {
                status: true,
                data: {
                    message: 'Phone verification is disabled',
                },
            };
        }
    }
}
