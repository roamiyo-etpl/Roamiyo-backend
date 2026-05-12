/**
 * TBO expects the same EndUserIp on Authenticate and on subsequent Air API calls for that session.
 * Optional TBO_END_USER_IP env overrides (e.g. whitelisted egress IP for server-to-server calls).
 */
export function resolveTboEndUserIp(
  headers?: Record<string, unknown>,
): string {
  const fromEnv = process.env.TBO_END_USER_IP?.trim();
  if (fromEnv) return fromEnv;

  const h = headers ?? {};
  const ipAddress = h['ip-address'] ?? h['IP-ADDRESS'];
  const xff = h['x-forwarded-for'] ?? h['X-Forwarded-For'];
  const xri = h['x-real-ip'] ?? h['X-Real-Ip'];
  const raw = ipAddress || xff || xri;
  if (raw != null && raw !== '') {
    return String(raw).split(',')[0].trim();
  }

  return '20.244.28.12';
}

export function redactTboCredentialsForLog(
  cred: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (!cred || typeof cred !== 'object') return cred;
  const out = { ...cred } as Record<string, unknown>;
  if ('password' in out) out.password = '[REDACTED]';
  if ('Password' in out) out.Password = '[REDACTED]';
  return out;
}
