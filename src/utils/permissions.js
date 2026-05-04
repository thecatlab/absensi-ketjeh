export const DEFAULT_BRIEFING_ROLES = ['Manager', 'Captain Floor'];
export const DEFAULT_RESERVATION_ROLES = ['Manager', 'Kasir'];

export function splitRoleList(value) {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean);
  return String(value || '')
    .split(/[,\n]/)
    .map(v => v.trim())
    .filter(Boolean);
}

export function joinRoleList(roles) {
  return splitRoleList(roles).join(',');
}

export function getSettingRoles(settings, key, fallback) {
  const roles = splitRoleList(settings?.[key]);
  return roles.length ? roles : fallback;
}

export function isRoleAllowed(role, settings, key, fallback) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (!normalizedRole) return false;
  return getSettingRoles(settings, key, fallback)
    .some(item => String(item).trim().toLowerCase() === normalizedRole);
}
