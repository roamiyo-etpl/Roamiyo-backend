import * as Joi from 'joi';

export const validationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'staging', 'uat', 'production'),
    SERVER_PORT: Joi.number().default(10000),
    LANGUAGES: Joi.string()
        .pattern(/^[a-zA-Z]+(\s*,\s*[a-zA-Z]+)*$/)
        .optional(),
});
