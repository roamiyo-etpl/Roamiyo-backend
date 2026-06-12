import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
    ModuleType,
    ProviderMaster,
} from 'src/shared/entities/provider-master.entity';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { DateUtility } from 'src/shared/utilities/flight/date.utility';

const TESTING_DATABASE_NAME = 'Testing-TTP-DB';
const TBO_PROVIDER_CODE = 'TBO';
const AUTHENTICATE_PATH = 'SharedData.svc/rest/Authenticate';

interface TboProviderCredentials {
    client_id?: string;
    username?: string;
    password?: string;
    auth_url?: string;
}

@Injectable()
export class TboAuthTokenRefreshScheduler {
    private readonly logger = new Logger(TboAuthTokenRefreshScheduler.name);

    constructor(
        @InjectRepository(ProviderMaster)
        private readonly providerRepository: Repository<ProviderMaster>,
    ) {}

    @Cron('0 */10 * * * *', { name: 'RefreshTboAuthToken' })
    async refreshTboAuthToken(): Promise<void> {
        if (process.env.DATABASE_NAME !== TESTING_DATABASE_NAME) {
            return;
        }

        this.logger.log('TBO auth token refresh started');

        try {
            const referenceProvider = await this.providerRepository.findOne({
                where: {
                    code: TBO_PROVIDER_CODE,
                    is_active: 'Active',
                    module_type: 'Flight' as ModuleType,
                },
            });

            if (!referenceProvider?.provider_credentials) {
                this.logger.error(
                    'TBO Flight provider row or credentials not found in provider_master',
                );
                return;
            }

            let credentials: TboProviderCredentials;
            try {
                credentials = JSON.parse(
                    referenceProvider.provider_credentials,
                ) as TboProviderCredentials;
            } catch {
                this.logger.error('Failed to parse TBO provider_credentials JSON');
                return;
            }

            const clientId = credentials.client_id;
            const userName = credentials.username;
            const password = credentials.password;
            const endUserIp =
                process.env.TBO_END_USER_IP?.trim() || '49.43.26.12';

            if (!clientId || !userName || !password) {
                this.logger.error(
                    'TBO credentials missing client_id, username, or password',
                );
                return;
            }

            const authBaseUrl = (credentials.auth_url || 'http://sharedapi.tektravels.com/').replace(
                /\/?$/,
                '/',
            );
            const endpoint = `${authBaseUrl}${AUTHENTICATE_PATH}`;

            const requestBody = {
                ClientId: clientId,
                UserName: userName,
                Password: password,
                EndUserIp: endUserIp,
            };

            const sessionData = await Http.httpRequestTBO(
                'POST',
                endpoint,
                JSON.stringify(requestBody),
            );

            if (sessionData?.Status !== 1 || !sessionData?.TokenId) {
                this.logger.error(
                    `TBO Authenticate failed: ${JSON.stringify(sessionData?.Error ?? sessionData)}`,
                );
                return;
            }

            const tokenId = sessionData.TokenId as string;
            const tokenUpdatedAt = DateUtility.currentDateOnlyIST();

            await this.providerRepository.update(
                {
                    code: TBO_PROVIDER_CODE,
                    module_type: In(['Flight', 'Hotel'] as ModuleType[]),
                },
                { authToken: tokenId, tokenUpdatedAt },
            );

            this.logger.log(
                `TBO authToken updated for Flight and Hotel (token prefix: ${tokenId.slice(0, 8)}...)`,
            );
        } catch (error) {
            this.logger.error('TBO auth token refresh failed', error);
        }
    }
}
