"use strict";
/**
 * @module utils
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.invariant = void 0;
/**
 * Checks invariant violation against a condition, will throw an error if not fulfilled
 * @internal
 * @param {boolean} condition
 * @param {string} message
 */
exports.invariant = function (condition, message) {
    if (!!condition === true) {
        return;
    }
    throw new Error("Invariant violation: " + message);
};
//# sourceMappingURL=invariant.js.map