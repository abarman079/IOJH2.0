export type ProviderResult = {outcome:'accepted'; providerId:string}|{outcome:'retry'|'permanent';code:string;cooldownSeconds?:number};
export declare function classifyResendStatus(status:number, apiCode?:string): {outcome:'retry'|'permanent';code:string};
export declare function sendResend(args:{apiKey:string;from:string;to:string;subject:string;html:string;text:string;notificationId:string;fetchImpl?:typeof fetch;signal?:AbortSignal}):Promise<ProviderResult>;
