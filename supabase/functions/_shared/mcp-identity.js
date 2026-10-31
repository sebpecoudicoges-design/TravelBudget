// Explicit server-side pilot allowlist; never derive privileges from user_metadata.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createMcpIdentityVerifier(serverAuth, allowedUsers = []) {
  if (typeof serverAuth?.getUser !== 'function' || typeof serverAuth?.admin?.getUserById !== 'function' ||
      !Array.isArray(allowedUsers) || !allowedUsers.every(id => UUID.test(id))) throw new Error('MCP identity configuration required');
  const allowed = new Set(allowedUsers);
  function active(user) {
    if (!UUID.test(user?.id || '') || user.deleted_at || user.is_anonymous) return false;
    if (user.banned_until && (!Number.isFinite(Date.parse(user.banned_until)) || Date.parse(user.banned_until) > Date.now())) return false;
    return true;
  }
  return {
    async verifySession(authorization) {
      if (typeof authorization !== 'string' || authorization.length > 8192 || !/^Bearer [^\s]+$/.test(authorization)) return null;
      // Auth validates the token remotely; decoding its payload locally is insufficient.
      const { data, error } = await serverAuth.getUser(authorization.slice(7));
      return !error && active(data?.user) ? data.user.id : null;
    },
    async isUserAllowed(userId) {
      if (!allowed.has(userId)) return false;
      // Recheck account deletion/suspension on every MCP access, without caching roles.
      const { data, error } = await serverAuth.admin.getUserById(userId);
      return !error && data?.user?.id === userId && active(data.user);
    },
  };
}
