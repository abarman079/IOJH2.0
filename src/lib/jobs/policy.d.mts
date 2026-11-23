export declare const PROBE_KIND: 'ops.probe';
export declare const PROBE_VERSION: 1;
export declare function validProbePayload(value: unknown): value is { correlationId: string };
export declare function validDeduplicationKey(value: unknown): value is string;
export declare function validErrorCode(value: unknown): value is string;
export declare function validWorkerId(value: unknown): value is string;
export declare function retryDelayBounds(attempt: number): readonly [number, number];
export declare function validNotificationReference(value: unknown): value is {
  notificationId: string; locale: 'en' | 'bn'; templateVersion: number;
};
