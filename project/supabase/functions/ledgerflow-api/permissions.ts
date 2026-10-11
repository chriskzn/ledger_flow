export function hasPermission(permissions: unknown, required: 'read' | 'write'): boolean {
  return Array.isArray(permissions) &&
    (permissions.includes(required) || permissions.includes('admin'));
}
export function isKeyExpired(expiresAt: string | null | undefined, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const time = Date.parse(expiresAt);
  return !Number.isFinite(time) || time <= now;
}
