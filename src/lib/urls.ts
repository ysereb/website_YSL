export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export function local(path = '/') {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  return `${base}/${path.replace(/^\//, '')}`;
}
