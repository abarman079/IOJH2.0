export declare const RESERVED_CMS_SLUGS: Set<string>;
export declare function validCmsSlug(value: unknown): boolean;
export declare function safeCmsHref(value: unknown): boolean;
export declare const MAX_IMAGE_BYTES: number;
export declare function inspectImage(input: Uint8Array | Buffer, mime: string): {ext: 'png' | 'jpg' | 'webp'; width:number; height:number};
