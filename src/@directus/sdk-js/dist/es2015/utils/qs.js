const defaultSerializeTransform = (key, value) => `${key}=${encodeURIComponent(value)}`;
export function querify(obj, prefix, serializer = defaultSerializeTransform) {
    let qs = [], prop;
    for (prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            const key = prefix ? `${prefix}[${prop}]` : prop;
            const val = obj[prop];
            qs.push(val !== null && typeof val === "object" ? querify(val, key) : serializer(key, val));
        }
    }
    return qs.join("&");
}
//# sourceMappingURL=qs.js.map