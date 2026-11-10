// Supabase request headers for a key. Legacy keys (anon, service_role) are
// JWTs and also go in Authorization. The newer keys (sb_publishable_…,
// sb_secret_…) are not JWTs: Supabase rejects them in Authorization, so they
// go in the apikey header only.
export const keyHeaders = (key) => (/^eyJ/.test(key || '') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key })
