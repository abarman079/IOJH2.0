export function createRecoveryToken(userId: string, authUpdatedAt: string, key: string, now?: number): string;
export function validRecoveryToken(token: unknown, userId: string, authUpdatedAt: unknown, key: unknown, now?: number): boolean;
