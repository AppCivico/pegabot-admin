"use strict";
/**
 * @module utils
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isObject = exports.isArray = exports.isArrayOrEmpty = exports.isObjectOrEmpty = exports.isFunction = exports.isNumber = exports.isString = exports.isNotNull = void 0;
/**
 * @internal
 */
var isType = function (t, v) { return Object.prototype.toString.call(v) === "[object " + t + "]"; };
/**
 * @internal
 */
exports.isNotNull = function (v) { return v !== null && v !== undefined; };
/**
 * @internal
 */
exports.isString = function (v) { return v && typeof v === "string" && /\S/.test(v); };
/**
 * @internal
 */
exports.isNumber = function (v) { return isType("Number", v) && isFinite(v) && !isNaN(parseFloat(v)); };
/**
 * @internal
 */
exports.isFunction = function (v) { return v instanceof Function; };
/**
 * @internal
 */
exports.isObjectOrEmpty = function (v) { return isType("Object", v); };
/**
 * @internal
 */
exports.isArrayOrEmpty = function (v) { return isType("Array", v); };
/**
 * @internal
 */
exports.isArray = function (v) { return (!exports.isArrayOrEmpty(v) ? false : v.length > 0); };
/**
 * @internal
 */
exports.isObject = function (v) {
    if (!exports.isObjectOrEmpty(v)) {
        return false;
    }
    for (var key in v) {
        if (Object.prototype.hasOwnProperty.call(v, key)) {
            return true;
        }
    }
    return false;
};
//# sourceMappingURL=is.js.map