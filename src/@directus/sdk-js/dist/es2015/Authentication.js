/**
 * @module Authentication
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Utilities
import { isFunction, isString } from "./utils/is";
import { getPayload } from "./utils/payload";
/**
 * Handles all authentication related logic, decoupled from the core
 * @internal
 * @author Jan Biasi <biasijan@gmail.com>
 */
export class Authentication {
    /**
     * Creates a new authentication instance
     * @constructor
     * @param {IConfiguration} config
     * @param {IAuthenticationInjectableProps} inject
     */
    constructor(config, inject) {
        this.config = config;
        this.inject = inject;
        // Only start the auto refresh interval if the token exists and it's a JWT
        if (config.token && config.token.includes(".")) {
            this.startInterval(true);
        }
    }
    /**
     * Login to the API; Gets a new token from the API and stores it in this.token.
     * @param {ILoginCredentials} credentials   User login credentials
     * @param {ILoginOptions?} options          Additional options regarding persistance and co.
     * @return {Promise<IAuthenticateResponse>}
     */
    login(credentials, options) {
        this.config.token = undefined;
        if (credentials.url && isString(credentials.url)) {
            this.config.url = credentials.url;
        }
        if (credentials.project && isString(credentials.project)) {
            this.config.project = credentials.project;
        }
        if (options && isString(options.mode)) {
            this.config.mode = options.mode;
        }
        if (credentials.persist || (options && options.persist) || this.config.persist) {
            // use interval for login refresh when option persist enabled
            this.startInterval();
        }
        let body = {
            email: credentials.email,
            password: credentials.password,
            mode: "jwt",
        };
        if (this.config.mode === "cookie") {
            body.mode = "cookie";
        }
        if (credentials.otp) {
            body.otp = credentials.otp;
        }
        const activeRequest = this.inject.post("/auth/authenticate", body);
        if (this.config.mode === "jwt") {
            activeRequest
                .then((res) => {
                // save new token in configuration
                this.config.token = res.data.token;
                return res;
            })
                .then((res) => {
                this.config.token = res.data.token;
                this.config.localExp = new Date(Date.now() + (this.config.tokenExpirationTime || 0)).getTime();
                return res;
            });
        }
        return activeRequest;
    }
    /**
     * Logs the user out by "forgetting" the token, and clearing the refresh interval
     */
    logout() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.inject.request("post", "/auth/logout", {}, {}, false);
            this.config.token = undefined;
            if (this.refreshInterval) {
                this.stopInterval();
            }
            return response;
        });
    }
    /// REFRESH METHODS ----------------------------------------------------------
    /**
     * Refresh the token if it is about to expire (within 30 seconds of expiry date).
     * - Calls onAutoRefreshSuccess with the new token if the refreshing is successful.
     * - Calls onAutoRefreshError if refreshing the token fails for some reason.
     * @return {RefreshIfNeededResponse}
     */
    refreshIfNeeded() {
        const payload = this.getPayload();
        const { token, localExp } = this.config;
        if (!isString(token)) {
            return;
        }
        if (!payload || !payload.exp) {
            return;
        }
        const timeDiff = (localExp || 0) - Date.now();
        if (timeDiff <= 0) {
            // token has expired, skipping auto refresh
            if (isFunction(this.onAutoRefreshError)) {
                // @ts-ignore
                this.onAutoRefreshError({
                    code: 102,
                    message: "auth_expired_token",
                });
            }
            return;
        }
        if (timeDiff < 30000) {
            return new Promise((resolve) => {
                if (token) {
                    this.refresh(token)
                        .then((res) => {
                        this.config.localExp = new Date(Date.now() + (this.config.tokenExpirationTime || 0)).getTime();
                        this.config.token = res.data.token || token;
                        // if autorefresh succeeded
                        if (isFunction(this.onAutoRefreshSuccess)) {
                            // @ts-ignore
                            this.onAutoRefreshSuccess(this.config);
                        }
                        resolve([true]);
                    })
                        .catch((error) => {
                        if (isFunction(this.onAutoRefreshError)) {
                            // @ts-ignore
                            this.onAutoRefreshError(error);
                        }
                        resolve([true, error]);
                    });
                }
            });
        }
        else {
            Promise.resolve([false]);
        }
    }
    /**
     * Use the passed token to request a new one.
     * @param {string} token
     */
    refresh(token) {
        return this.inject.post("/auth/refresh", { token });
    }
    /**
     * Starts an interval of 10 seconds that will check if the token needs refreshing
     * @param {boolean?} fireImmediately    If it should immediately call [refreshIfNeeded]
     */
    startInterval(fireImmediately) {
        if (fireImmediately) {
            this.refreshIfNeeded();
        }
        this.refreshInterval = setInterval(this.refreshIfNeeded.bind(this), 10000);
    }
    /**
     * Clears and nullifies the token refreshing interval
     */
    stopInterval() {
        clearInterval(this.refreshInterval);
        this.refreshInterval = undefined;
    }
    /**
     * Gets the payload of the current token, return type can be generic
     * @typeparam T     The payload response type, arbitrary object
     * @return {T}
     */
    getPayload() {
        if (!isString(this.config.token)) {
            return null;
        }
        return getPayload(this.config.token);
    }
}
//# sourceMappingURL=Authentication.js.map