export const SWG_HEADER_API_VERSION_MANDATE = {
    name: 'Api-version',
    enum: ['v1'],
    description: 'Please enter API version.',
    required: true,
};

export const SWG_HEADER_IP_NON_MANDATE = {
    name: 'Ip-Address',
    description: 'Please enter IP address. (e.g., 127.0.0.1)',
    required: false,
};

export const SWG_HEADER_IP_MANDATE = {
    name: 'Ip-Address',
    description: 'Please enter IP address. (e.g., 127.0.0.1)',
    required: true,
};

export const SWG_HEADER_CURRENCY_PREFERENCE = {
    name: 'Currency-Preference',
    description: 'Please enter preferred currency code. (3 digit currency code)',
    required: true,
};

export const SWG_HEADER_CURRENCY_PREFERENCE_MANDATE = {
    name: 'Currency-Preference',
    description: 'Please enter preferred currency code. (3 digit currency code)',
    required: true,
};

export const SWG_HEADER_LANGUAGE_PREFERENCE_MANDATE = {
    name: 'language',
    description: 'Please enter preferred language. (e.g., english,french)',
    required: true,
};

export const SWG_HEADER_CLUB_ID_MANDATE = {
    name: 'Club-Id',
    description: 'Please enter club id.',
    required: true,
};
export const SWG_HEADER_DEVICE_INFORMATION_MANDATE = {
    name: 'Device-Information',
    description: 'Please enter device-information id.',
    required: true,
};

export const DEC_HEADER_CLUB_ID_MANDATE = 'Club-Id';
export const DEC_HEADER_IP_ADDRESS_MANDATE = 'Ip-Address';
export const DEC_HEADER_API_VERSION_MANDATE = 'Api-version';
export const DEC_HEADER_CURRENCY_PREFERENCE_MANDATE = 'Currency-Preference';
export const DEC_HEADER_LANGUAGE_PREFERENCE_MANDATE = 'Language';
export const DEC_HEADER_DEVICE_INFORMATION_MANDATE = 'Device-information';
