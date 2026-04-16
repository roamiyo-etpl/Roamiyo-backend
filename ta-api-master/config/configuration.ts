export const Configuration = () => ({
    server: {
        env: process.env.NODE_ENV,
        port: parseInt(process.env.SERVER_PORT as string),
        origin: process.env.WHITELIST ? (JSON.parse(process.env.WHITELIST) as string[]) : [],
    },
    mwr: {
        mwr_api: process.env.MWR_LIFE_LOGIN_URL,
        loyalty_points_api: {
            base_url: process.env.MWR_LIFE_API_BASE_URL,
            loyalty_points_list: process.env.MWR_LIFE_LOYALTY_POINTS_LIST_URL,
            loyalty_points_balance: process.env.MWR_LIFE_LOYALTY_POINTS_BALANCE_URL,
        },
    },

    main_db: {
        host: process.env.DATABASE_HOST,
        port: parseInt(process.env.DATABASE_PORT as string),
        username: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASS,
        database: process.env.DATABASE_NAME,
        synchronize: process.env.DATABASE_SYNC,
    },

    app: {
        languages: (process.env.LANGUAGES ?? 'english')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        currency_rate_api_key: process.env.CURR_RATE_API_KEY,
        currency_rate_api_url: process.env.CURR_RATE_API_URL,
        can_add_unlimited_traveler: (process.env.CAN_ADD_UNLIMITED_TRAVELER ?? '')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
    },

    email: {
        host: process.env.EMAIL_HOST,
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        port: parseInt(process.env.EMAIL_PORT as string),
        secure: process.env.EMAIL_SECURE == 'true',
        bcc: process.env.EMAIL_BCC,
        cc: process.env.EMAIL_CC,
        from: process.env.EMAIL_FROM,
    },

    s3: {
        accesskey: process.env.AWS_S3_ACCESS_KEY,
        secretKey: process.env.AWS_S3_SECRET_KEY,
        bucketName: process.env.AWS_S3_BUCKET_NAME,
        awsRegion: process.env.AWS_REGION,
        cloudfrontUrl: process.env.AWS_CLOUDFRONT_URL,
    },

    azure: {
        blob_sas_link: process.env.AZURE_BLOB_SAS_LINK,
    },
});
