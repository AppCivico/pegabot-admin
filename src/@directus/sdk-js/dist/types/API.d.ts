/**
 * @module API
 */
import { AxiosInstance } from "axios";
import { IAuthentication } from "./Authentication";
import { concurrencyManager } from "./ConcurrencyManager";
import { IConfiguration } from "./Configuration";
import { BodyType } from "./schemes/http/Body";
import { RequestMethod } from "./schemes/http/Request";
import { IErrorResponse } from "./schemes/response/Error";
export interface IAPI {
    auth: IAuthentication;
    xhr: AxiosInstance;
    concurrent: ReturnType<typeof concurrencyManager>;
    reset(): void;
    get<T extends any = any>(endpoint: string, params?: object): Promise<T>;
    post<T extends any = any>(endpoint: string, body?: BodyType, params?: object): Promise<T>;
    patch<T extends any = any>(endpoint: string, body?: BodyType, params?: object): Promise<T>;
    put<T extends any = any>(endpoint: string, body?: BodyType, params?: object): Promise<T>;
    delete<T extends any = any>(endpoint: string): Promise<T>;
    getPayload<T extends object = object>(): T | null;
    request<T extends any = any>(method: RequestMethod, endpoint: string, params?: object, data?: object, noProject?: boolean, headers?: {
        [key: string]: string;
    }, skipParseToJSON?: boolean): Promise<T>;
}
export declare class APIError extends Error {
    message: string;
    private info;
    constructor(message: string, info: {
        code: number | string;
        method: string;
        url: string;
        params?: object;
        error?: IErrorResponse;
        data?: any;
    });
    get url(): string;
    get method(): string;
    get code(): string;
    get params(): object;
    toString(): string;
}
/**
 * API definition for HTTP transactions
 * @uses Authentication
 * @uses axios
 * @author Jan Biasi <biasijan@gmail.com>
 */
export declare class API implements IAPI {
    private config;
    auth: IAuthentication;
    xhr: AxiosInstance;
    concurrent: ReturnType<typeof concurrencyManager>;
    constructor(config: IConfiguration);
    /**
     * Resets the client instance by logging out and removing the URL and project
     */
    reset(): void;
    /**
     * GET convenience method. Calls the request method for you
     * @typeparam T   response type
     * @return {Promise<T>}
     */
    get<T extends any = any>(endpoint: string, params?: object): Promise<T>;
    /**
     * POST convenience method. Calls the request method for you
     * @typeparam T   response type
     * @return {Promise<T>}
     */
    post<T extends any = any>(endpoint: string, body?: BodyType, params?: object): Promise<T>;
    /**
     * PATCH convenience method. Calls the request method for you
     * @typeparam T   response type
     * @return {Promise<T>}
     */
    patch<T extends any = any>(endpoint: string, body?: BodyType, params?: object): Promise<T>;
    /**
     * PUT convenience method. Calls the request method for you
     * @typeparam T   response type
     * @return {Promise<T>}
     */
    put<T extends any = any>(endpoint: string, body?: BodyType, params?: object): Promise<T>;
    /**
     * DELETE convenience method. Calls the request method for you
     * @typeparam T   response type
     * @return {Promise<T>}
     */
    delete<T extends any = any>(endpoint: string): Promise<T>;
    /**
     * Gets the payload of the current token, return type can be generic
     * @typeparam T   extends object, payload type
     * @return {T}
     */
    getPayload<T extends object = object>(): T | null;
    /**
     * Perform an API request to the Directus API
     * @param {RequestMethod} method    Selected HTTP method
     * @param {string} endpoint         Endpoint definition as path
     * @param {object={}} params        Query parameters
     * @param {object={}} data          Data passed to directus
     * @param {boolean=false} noProject Do not include the `project` in the url (for system calls)
     * @param {object={}} headers       Optional headers to include
     * @param {boolean=false} skipParseToJSON  Whether to skip `JSON.parse` or not
     * @typeparam T                     Response type definition, defaults to `any`
     * @return {Promise<T>}
     */
    request<T extends any = any>(method: RequestMethod, endpoint: string, params?: object, data?: object, noProject?: boolean, headers?: {
        [key: string]: string;
    }, skipParseToJSON?: boolean): Promise<T>;
}
//# sourceMappingURL=API.d.ts.map