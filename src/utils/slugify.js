const { nanoid } = require('nanoid');

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// e.g. "Grace Bistro" -> "grace-bistro-x7k2p"
function generateProductSlug(name) {
  const base = slugify(name) || 'product';
  const suffix = nanoid(5).toLowerCase();
  return `${base}-${suffix}`;
}

module.exports = { slugify, generateProductSlug };
