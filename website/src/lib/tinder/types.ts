export type RequestMethod = 'GET' | 'POST';
export type Endpoint = `/${string}`;

export type Locale = 'es-ES' | 'en-US' | 'fr-FR' | 'pt-BR' | 'de-DE' | 'it-IT' | 'ja-JP' | 'ko-KR' | 'zh-CN' | 'zh-TW' | 'ru-RU' | 'pl-PL' | 'tr-TR';

export type TinderResponse<T> = { data: T; response: any };

export interface ConfigurationOptions {
    headers?: Record<string, string>;
    defaultLocale: Locale;
}

export interface ConfigurationParameters {
    xAuthToken: string;
    baseOptions?: ConfigurationOptions;
}

export type RequestParams = GetRequestParams | PostRequestParams;

export type GetRequestParams = {
    method: 'GET';
    params?: URLSearchParams;
    endpoint: Endpoint;
};

export type PostRequestParams = {
    method: 'POST';
    data: any;
    params?: URLSearchParams;
    endpoint: Endpoint;
};

export interface Meta {
    status: number;
}

export interface TinderSearchParams {
    locale?: string;
    duos?: number;
}

export interface TinderSearchResponse {
    data: {
        results: Array<{
            s_number: string;
            user: {
                _id: string;
                name: string;
                bio?: string;
                birth_date?: string;
                photos: Array<{ id: string; url: string }>;
            };
        }>;
    };
}

export interface TinderMatchesParams {
    locale?: string;
    count?: number;
    message?: number;
    isTinderU?: boolean;
}

export interface TinderMatchesResponse {
    data: {
        matches: Array<{
            id: string;
            person: {
                _id: string;
                name: string;
                bio?: string;
                photos: Array<{ id: string; url: string }>;
            };
            messages: Array<{
                from: string;
                to: string;
                message: string;
                sent_date: string;
            }>;
        }>;
    };
}

export interface TinderChatMessagesParams {
    matchId: string;
    count?: number;
    locale?: string;
}

export interface TinderChatMessagesResponse {
    data: {
        messages: Array<{
            _id: string;
            match_id: string;
            sent_date: string;
            message: string;
            to: string;
            from: string;
        }>;
    };
}

export interface TinderProfileResponse {
    data: {
        user: {
            _id: string;
            name: string;
            email?: string;
        };
    };
}
