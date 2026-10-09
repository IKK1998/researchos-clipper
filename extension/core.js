export function articleURL(value) {
  try {
    const u = new URL(value.trim());
    if (u.protocol !== 'https:' || u.hostname !== 'mp.weixin.qq.com' || u.username || u.password ||
        !(/^\/s\/[\w-]+$/.test(u.pathname) || (u.pathname === '/s' && u.search))) return null;
    u.hash = ''; return u.href;
  } catch { return null; }
}
export function validTitle(value) {
  const t = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return t && t.length <= 1000 && !/^https?:\/\//i.test(t) &&
    !/^(微信|微信公众平台|微信公众号文章|未知错误|环境异常|安全验证|验证|请完成验证|Just a moment\.\.\.|Access denied)$/i.test(t) ? t : '';
}
export function websiteOrigin(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash)
    throw new Error('网站地址需为 HTTPS 根地址');
  return u.origin;
}
