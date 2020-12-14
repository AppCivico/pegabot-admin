export declare type QuerifySerializer = (key: string, value: string | number | boolean) => string;
export declare function querify(obj: {
    [index: string]: any;
}, prefix?: string, serializer?: QuerifySerializer): string;
//# sourceMappingURL=qs.d.ts.map