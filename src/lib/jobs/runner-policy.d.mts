export const LIMITS: Readonly<{durationMs:number;maxJobs:number;rpcMs:number;providerMs:number;emailBudgetMs:number;probeBudgetMs:number;leaseSeconds:number}>;
export function runnerConfiguration(env:Record<string,string|undefined>):{state:'disabled'|'invalid'}|{state:'ready';secret:string};
export function authorizedBearer(header:string|null,secret:string):boolean;
export type EmailConfiguration={apiKey:string;from:string;recipient:string;site:string;notificationId:string};
export function emailConfiguration(env:Record<string,string|undefined>,site:string|null):EmailConfiguration|null;
export function budgetDecision(remaining:number,emailReady:boolean):{claim:boolean;email:boolean};
export function fingerprint(input:{apiKey:string;from:string;to:string;subject:string;html:string;text:string}):string;
export function cooldownFor(result:{outcome:string;cooldownSeconds?:number}):number;
export function validRunnerBody(request:Request):Promise<boolean>;

export function methodDenied():Response;
export function handleRunnerRequest(request:Request,env:Record<string,string|undefined>,execute:()=>Promise<{busy:boolean;ok:boolean;summary:Record<string,number>}>):Promise<Response>;
