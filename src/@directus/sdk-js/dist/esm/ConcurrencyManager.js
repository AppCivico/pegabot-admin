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
export var concurrencyManager = function (axios, limit) {
    if (limit === void 0) { limit = 10; }
    if (limit < 1) {
        throw new Error("ConcurrencyManager Error: minimun concurrent requests is 1");
    }
    var instance = {
        queue: [],
        running: [],
        interceptors: {
            request: 0,
            response: 0,
        },
        shiftInitial: function () {
            setTimeout(function () {
                if (instance.running.length < limit) {
                    instance.shift();
                }
            }, 0);
        },
        push: function (reqHandler) {
            instance.queue.push(reqHandler);
            instance.shiftInitial();
        },
        shift: function () {
            if (instance.queue.length) {
                var queued = instance.queue.shift();
                if (queued) {
                    queued.resolver(queued.request);
                    instance.running.push(queued);
                }
            }
        },
        // use as interceptor. Queue outgoing requests
        requestHandler: function (req) {
            return new Promise(function (resolve) {
                instance.push({
                    request: req,
                    resolver: resolve,
                });
            });
        },
        // use as interceptor. Execute queued request upon receiving a response
        responseHandler: function (res) {
            instance.running.shift();
            instance.shift();
            return res;
        },
        responseErrorHandler: function (res) {
            return Promise.reject(instance.responseHandler(res));
        },
        detach: function () {
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