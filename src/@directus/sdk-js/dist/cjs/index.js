"use strict";
/**
 * @module exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPayload = exports.getCollectionItemPath = exports.concurrencyManager = exports.SDK = exports.Configuration = void 0;
var Configuration_1 = require("./Configuration");
Object.defineProperty(exports, "Configuration", { enumerable: true, get: function () { return Configuration_1.Configuration; } });
var SDK_1 = require("./SDK");
Object.defineProperty(exports, "SDK", { enumerable: true, get: function () { return SDK_1.SDK; } });
var ConcurrencyManager_1 = require("./ConcurrencyManager");
Object.defineProperty(exports, "concurrencyManager", { enumerable: true, get: function () { return ConcurrencyManager_1.concurrencyManager; } });
var collection_1 = require("./utils/collection");
Object.defineProperty(exports, "getCollectionItemPath", { enumerable: true, get: function () { return collection_1.getCollectionItemPath; } });
var payload_1 = require("./utils/payload");
Object.defineProperty(exports, "getPayload", { enumerable: true, get: function () { return payload_1.getPayload; } });
/**
 * @deprecated please use named imports instead of defaults
 * @preferred {@link exports.SDK}
 */
exports.default = SDK_1.SDK;
//# sourceMappingURL=index.js.map