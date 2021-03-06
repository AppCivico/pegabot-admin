/**
 * @module API
 */
import axios from "axios";
import { Authentication } from "./Authentication";
import { concurrencyManager } from "./ConcurrencyManager";
// Utilities
import { isString } from "./utils/is";
import { getPayload } from "./utils/payload";
import { querify } from "./utils/qs";
export class APIError extends Error {
    constructor(message, info) {
        super(message); // 'Error' breaks prototype chain here
        this.message = message;
        this.info = info;
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    }
    get url() {
        return this.info.url;
    }
    get method() {
        return this.info.method.toUpperCase();
    }
    get code() {
        return `${this.info.code || -1}`;
    }
    get params() {
        return this.info.params || {};
    }
    toString() {
        return [
            "Directus call failed:",
            `${this.method} ${this.url} ${JSON.stringify(this.params)} -`,
            this.message,
            `(code ${this.code})`,
        ].join(" ");
    }
}
/**
 * API definition for HTTP transactions
 * @uses Authentication
 * @uses axios
 * @author Jan Biasi <biasijan@gmail.com>
 */
export class API {
    constructor(config) {
        this.config = config;
        const axiosOptions = {
            paramsSerializer: querify,
            timeout: 10 * 60 * 1000,
            withCredentials: false,
        };
        if (config.mode === "cookie") {
            axiosOptions.withCredentials = true;
        }
        this.xhr = axios.create(axiosOptions);
        this.auth = new Authentication(config, {
            post: this.post.bind(this),
            xhr: this.xhr,
            request: this.request.bind(this),
        });
        this.concurrent = concurrencyManager(this.xhr, 10);
    }
    /**
     * Resets the client instance by logging out and removing the URL and project
     */
    reset() {
        this.auth.logout();
        this.config.deleteHydratedConfig();
    }
    /// REQUEST METHODS ----------------------------------------------------------
    /**
     * GET convenience method. Calls the request method for you
     * @typeparam T   response type
     * @return {Promise<T>}
     */
    get(endpoint, params = {}) {
        return this.request("get", endpoint, params);
    }
    /**
     * POST convenience method. Calls the request method for you
     * @typeparam T   response type
     * @return {Promise<T>}
     */
    post(endpoint, body = {}, params = {}) {
        return this.request("post", endpoint, params, body);
    }
    /**
     * PATCH convenience method. Calls the request method for you
     * @typeparam T   response type
     * @return {Promise<T>}
     */
    patch(endpoint, body = {}, params = {}) {
        return this.request("patch", endpoint, params, body);
    }
    /**
     * PUT convenience method. Calls the request method for you
     * @typeparam T   response type
     * @return {Promise<T>}
     */
    put(endpoint, body = {}, params = {}) {
        return this.request("put", endpoint, params, body);
    }
    /**
     * DELETE convenience method. Calls the request method for you
     * @typeparam T   response type
     * @return {Promise<T>}
     */
    delete(endpoint) {
        return this.request("delete", endpoint);
    }
    /**
     * Gets the payload of the current token, return type can be generic
     * @typeparam T   extends object, payload type
     * @return {T}
     */
    getPayload() {
        if (!isString(this.config.token)) {
            return null;
        }
        return getPayload(this.config.token);
    }
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
    request(method, endpoint, params = {}, data, noProject = false, headers = {}, skipParseToJSON = false) {
        if (!this.config.url) {
            throw new Error("SDK has no URL configured to send requests to, please check the docs.");
        }
        if (noProject === false && !this.config.project) {
            throw new Error("SDK has no project configured to send requests to, please check the docs.");
        }
        let baseURL = `${this.config.url}`;
        if (baseURL.endsWith("/") === false)
            baseURL += "/";
        if (noProject === false) {
            baseURL += `${this.config.project}/`;
        }
        const requestOptions = {
            baseURL,
            data,
            headers,
            method,
            params,
            url: endpoint,
        };
        if (this.config.token && isString(this.config.token) && this.config.token.length > 0) {
            requestOptions.headers = headers;
            requestOptions.headers.Authorization = `Bearer ${this.config.token}`;
        }
        if (this.config.project) {
            requestOptions.headers["X-Directus-Project"] = this.config.project;
        }
        return this.xhr
            .request(requestOptions)
            .then((res) => res.data)
            .then((responseData) => {
            if (!responseData || responseData.length === 0) {
                return responseData;
            }
            if (typeof responseData !== "object") {
                try {
                    return skipParseToJSON ? responseData : JSON.parse(responseData);
                }
                catch (error) {
                    throw {
                        data: responseData,
                        error,
                        json: true,
                    };
                }
            }
            return responseData;
        })
            .catch((error) => {
            const errorResponse = error
                ? error.response || {}
                : {};
            const errorResponseData = errorResponse.data || {};
            const baseErrorInfo = {
                error,
                url: requestOptions.url,
                method: requestOptions.method,
                params: requestOptions.params,
                code: errorResponseData.error ? errorResponseData.error.code || error.code || -1 : -1,
            };
            if (error && error.response && errorResponseData.error) {
                throw new APIError(errorResponseData.error.message || "Unknown error occured", baseErrorInfo);
            }
            else if (error.response && error.response.json === true) {
                throw new APIError("API returned invalid JSON", Object.assign(Object.assign({}, baseErrorInfo), { code: 422 }));
            }
            else {
                throw new APIError("Network error", Object.assign(Object.assign({}, baseErrorInfo), { code: -1 }));
            }
        });
    }
}
//# sourceMappingURL=API.js.map