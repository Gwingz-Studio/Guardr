import type {
    ConfigurationParameters,
    ConfigurationOptions,
    Endpoint,
    TinderResponse,
    RequestParams,
    TinderSearchParams,
    TinderSearchResponse,
    TinderMatchesParams,
    TinderMatchesResponse,
    TinderChatMessagesParams,
    TinderChatMessagesResponse,
    TinderProfileResponse,
} from './types';

const BASE_PATH = 'https://api.gotinder.com';
const API_V = '/v2';

export const TINDER_ROUTER = {
    profile: `${API_V}/profile`,
    search: `${API_V}/recs/core`,
    matches: `${API_V}/matches`,
    chatMessages: `${API_V}/matches`,
    location: `${API_V}/meta`,
} as const;

export class TinderAPI {
    private baseUrl: string = BASE_PATH;
    private xAuthToken: string;
    private baseOptions: ConfigurationOptions;

    constructor(param: ConfigurationParameters) {
        this.xAuthToken = param.xAuthToken;
        this.baseOptions = param.baseOptions ?? { defaultLocale: 'en-US' };
        this.baseOptions.headers = {
            'X-AUTH-TOKEN': this.xAuthToken,
            ...this.baseOptions.headers,
        };
    }

    private async request({ method, endpoint, ...rest }: RequestParams): Promise<any> {
        try {
            const urlObj = new URL(endpoint, this.baseUrl);
            
            if ('params' in rest && rest.params) {
                rest.params.forEach((value, key) => {
                    urlObj.searchParams.append(key, value);
                });
            }

            const headers = new Headers({
                'Content-Type': 'application/json',
                ...this.baseOptions.headers,
            });

            const init: RequestInit = {
                method,
                headers,
            };

            if (method === 'POST' && 'data' in rest && rest.data) {
                init.body = JSON.stringify(rest.data);
            }

            const response = await fetch(urlObj.toString(), init);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get('content-type') ?? '';
            let data: any;
            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            return {
                data,
                response,
            };
        } catch (error: any) {
            throw new Error(`Tinder Request Failed: ${error.message}`);
        }
    }

    private get<T>(endpoint: Endpoint, params?: URLSearchParams): Promise<TinderResponse<T>> {
        return this.request({ endpoint, params, method: 'GET' });
    }

    private post<T>(endpoint: Endpoint, data = {}, params?: URLSearchParams): Promise<TinderResponse<T>> {
        return this.request({ endpoint, data, params, method: 'POST' });
    }

    async search(params: TinderSearchParams = {}): Promise<TinderResponse<TinderSearchResponse>> {
        const query = new URLSearchParams();
        query.append('locale', params.locale ?? this.baseOptions.defaultLocale);
        query.append('duos', String(params.duos ?? 0));
        return this.get<TinderSearchResponse>(TINDER_ROUTER.search as Endpoint, query);
    }

    async profile(): Promise<TinderResponse<TinderProfileResponse>> {
        const query = new URLSearchParams({
            locale: this.baseOptions.defaultLocale,
            include: 'account,user',
        });
        return this.get<TinderProfileResponse>(TINDER_ROUTER.profile as Endpoint, query);
    }

    async getMatches(params: TinderMatchesParams = {}): Promise<TinderResponse<TinderMatchesResponse>> {
        const query = new URLSearchParams({
            locale: params.locale ?? this.baseOptions.defaultLocale,
            count: String(params.count ?? 60),
            message: String(params.message ?? 1),
            is_tinder_u: String(params.isTinderU ?? false),
        });
        return this.get<TinderMatchesResponse>(TINDER_ROUTER.matches as Endpoint, query);
    }

    async getChatMessages({ matchId, count = 100, locale }: TinderChatMessagesParams): Promise<TinderResponse<TinderChatMessagesResponse>> {
        const query = new URLSearchParams({
            locale: locale ?? this.baseOptions.defaultLocale,
            count: String(count),
        });
        const endpoint = `${TINDER_ROUTER.chatMessages}/${matchId}/messages` as Endpoint;
        return this.get<TinderChatMessagesResponse>(endpoint, query);
    }
}
