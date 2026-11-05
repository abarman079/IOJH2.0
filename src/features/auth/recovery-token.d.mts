export function createRecoveryToken(userId: string, key: string, now?: number): string;
export function validRecoveryToken(token: unknown, userId: string, key: unknown, now?: number): boolean;
