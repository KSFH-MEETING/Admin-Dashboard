import { env as cloudflareEnv } from 'cloudflare:workers';

export function optionalEnv(name: string): string {
  const bindings = cloudflareEnv as unknown as Record<string, unknown>;
  const value = bindings[name] ?? process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function requiredEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) throw new Error(`Server configuration missing: ${name}`);
  return value;
}

export function isConfigured() {
  return Boolean(
    optionalEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL') &&
    optionalEnv('GOOGLE_PRIVATE_KEY') &&
    optionalEnv('GOOGLE_SHEET_ID') &&
    optionalEnv('GOOGLE_CALENDAR_ID'),
  );
}
