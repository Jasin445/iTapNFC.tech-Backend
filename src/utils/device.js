function deviceFromUserAgent(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'ios';
  if (ua.includes('android')) return 'android';
  return 'other';
}

module.exports = { deviceFromUserAgent };
