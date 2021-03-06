var defaultSerializeTransform = function (key, value) { return key + "=" + encodeURIComponent(value); };
export function querify(obj, prefix, serializer) {
    if (serializer === void 0) { serializer = defaultSerializeTransform; }
    var qs = [], prop;
    for (prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            var key = prefix ? prefix + "[" + prop + "]" : prop;
            var val = obj[prop];
            qs.push(val !== null && typeof val === "object" ? querify(val, key) : serializer(key, val));
        }
    }
    return qs.join("&");
}
//# sourceMappingURL=qs.js.map