import { ProviderMaster } from 'src/shared/entities/provider-master.entity';

export class HotelProviderUtility {
    static parseCredentials(credentials: string | Record<string, any>): Record<string, any> {
        if (!credentials) {
            return {};
        }
        return typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
    }

    /** Builds provider mode string matching flight format, e.g. TBO-Test or TBO-Production */
    static buildMode(providerCode: string, credentials: string | Record<string, any>, dbProviderMode?: string): string {
        const cred = this.parseCredentials(credentials);
        const code = cred?.provider || providerCode || 'TBO';
        const mode = cred?.mode || dbProviderMode || 'Test';
        return `${code}-${mode}`;
    }

    static mapActiveProviders(providersData: ProviderMaster[], parseCredentials = false): any[] {
        return providersData.map((data) => ({
            providerId: data.provider_id,
            code: data.code,
            assignedId: data.provider_id,
            providerMode: data.provider_mode,
            providerCredentials: parseCredentials
                ? typeof data.provider_credentials === 'string'
                    ? JSON.parse(data.provider_credentials)
                    : data.provider_credentials
                : data.provider_credentials,
        }));
    }

    static resolveResponseMode(activeProviders: any[]): string {
        if (!activeProviders?.length) {
            return 'TBO-Test';
        }

        const tboProvider = activeProviders.find((item) => {
            const cred = this.parseCredentials(item.providerCredentials);
            return cred?.provider === 'TBO' || item.code === 'TBO';
        });

        const primary = tboProvider || activeProviders[0];
        return this.buildMode(primary.code, primary.providerCredentials, primary.providerMode);
    }

    static modeFromCredentials(providerCredentials: Record<string, any>): string {
        const code = providerCredentials?.provider || 'TBO';
        const mode = providerCredentials?.mode || 'Test';
        return `${code}-${mode}`;
    }
}
