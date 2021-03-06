/**
 * @module ConcurrencyManager
 */
/**
 * Handling and limiting concurrent requests for the API.
 * @param {AxiosInstance} axios   Reference to the caller instance
 * @param {number=10} limit       How many requests to allow at once
 *
 * Based on https://github.com/bernawil/axios-concurrency/blob/master/index.js
 */
export const concurrencyManager = (axios, limit = 10) => {
    if (limit < 1) {
        throw new Error("ConcurrencyManager Error: minimun concurrent requests is 1");
    }
    const instance = {
        queue: [],
        running: [],
        interceptors: {
            request: 0,
            response: 0,
        },
        shiftInitial() {
            setTimeout(() => {
                if (instance.running.length < limit) {
                    instance.shift();
                }
            }, 0);
        },
        push(reqHandler) {
            instance.queue.push(reqHandler);
            instance.shiftInitial();
        },
        shift() {
            if (instance.queue.length) {
                const queued = instance.queue.shift();
                if (queued) {
                    queued.resolver(queued.request);
                    instance.running.push(queued);
                }
            }
        },
        // use as interceptor. Queue outgoing requests
        requestHandler(req) {
            return new Promise(resolve => {
                instance.push({
                    request: req,
                    resolver: resolve,
                });
            });
        },
        // use as interceptor. Execute queued request upon receiving a response
        responseHandler(res) {
            instance.running.shift();
            instance.shift();
            return res;
        },
        responseErrorHandler(res) {
            return Promise.reject(instance.responseHandler(res));
        },
        detach() {
            axios.interceptors.request.eject(instance.interceptors.request);
            axios.interceptors.response.eject(instance.interceptors.response);
        },
    };
    // queue concurrent requests
    instance.interceptors.request = axios.interceptors.request.use(instance.requestHandler);
    instance.interceptors.response = axios.interceptors.response.use(instance.responseHandler, instance.responseErrorHandler);
    return instance;
};
//# sourceMappingURL=ConcurrencyManager.js.map