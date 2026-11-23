export declare function verifyResendWebhook(args:{id:string|null;timestamp:string|null;signature:string|null;body:string;secret:string;now?:number}):boolean;
export declare function parseResendEvent(input:unknown):{type:'email.delivered'|'email.bounced'|'email.complained'|'email.suppressed';emailId:string};
