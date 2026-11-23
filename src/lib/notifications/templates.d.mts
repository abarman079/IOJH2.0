export type Locale = 'en' | 'bn';
export type TemplateInput = { templateId:'account_notice'; templateVersion:1; locale:Locale; reference:string };
export declare const TEMPLATE_ID: 'account_notice';
export declare const TEMPLATE_VERSION: 1;
export declare const TEMPLATE_LOCALES: ReadonlyArray<Locale>;
export declare function escapeHtml(value: unknown): string;
export declare function validateTemplateInput(value: unknown): TemplateInput;
export declare function renderNotification(input: TemplateInput, siteOrigin: string): {subject:string;html:string;text:string;templateId:'account_notice';templateVersion:1;locale:Locale};
