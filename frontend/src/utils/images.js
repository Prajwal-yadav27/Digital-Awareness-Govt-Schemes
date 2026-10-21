import { coverPlaceholder } from './placeholder';

/**
 * Category → curated local imagery (see public/images/).
 * Fallback chain: DB imageUrl → local category image → placeholder SVG.
 * Local files are fixed Unsplash CDN photo IDs vendored into the repo
 * (Unsplash License; same curation as before, zero hotlink risk), except
 * hero-agriculture.jpg (farmers in India, verified free license).
 * Transport reuses the neutral default: its former CDN URL no longer
 * resolves, which is exactly why fallbacks are local now.
 */
const SCHEME_IMAGES = {
  Agriculture: '/images/card-agriculture.jpg',
  Education: '/images/card-education.jpg',
  Healthcare: '/images/card-healthcare.jpg',
  Health: '/images/card-healthcare.jpg',
  'Housing & Urban': '/images/card-housing.jpg',
  Housing: '/images/card-housing.jpg',
  Employment: '/images/card-employment.jpg',
  'Women & Child': '/images/card-women-child.jpg',
  Finance: '/images/card-finance.jpg',
  Financial: '/images/card-finance.jpg',
  'Social Welfare': '/images/card-welfare.jpg',
  Transport: '/images/card-default.jpg',
  Infrastructure: '/images/card-housing.jpg',
  Technology: '/images/card-technology.jpg',
  Sports: '/images/card-sports.jpg',
  Default: '/images/card-default.jpg',
};

const EVENT_IMAGES = {
  Health: '/images/card-event-health.jpg',
  Education: '/images/card-event-education.jpg',
  Agriculture: '/images/card-agriculture.jpg',
  Welfare: '/images/card-welfare.jpg',
  Employment: '/images/card-employment.jpg',
  'Skill Development': '/images/card-event.jpg',
  'Public Safety': '/images/card-default.jpg',
  Awareness: '/images/card-event.jpg',
  Default: '/images/card-event.jpg',
};

function isValidHttpUrl(str) {
  if (!str || typeof str !== 'string') return false;
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

export function getSchemeImage(scheme) {
  if (isValidHttpUrl(scheme?.imageUrl)) return scheme.imageUrl;
  const cat = scheme?.category || 'Default';
  return SCHEME_IMAGES[cat] || SCHEME_IMAGES[cat.split(' ')[0]] || SCHEME_IMAGES.Default;
}

export function getEventImage(event) {
  if (isValidHttpUrl(event?.imageUrl)) return event.imageUrl;
  const cat = event?.category || event?.department || 'Default';
  // Try exact, then first word, then default
  if (EVENT_IMAGES[cat]) return EVENT_IMAGES[cat];
  const first = cat.split(' ')[0];
  if (EVENT_IMAGES[first]) return EVENT_IMAGES[first];
  // Also try scheme category mapping
  if (SCHEME_IMAGES[cat]) return SCHEME_IMAGES[cat];
  return EVENT_IMAGES.Default;
}

export function getSmartImage({ imageUrl, category, type = 'scheme', title, state, sourceType }) {
  const fallback = type === 'event' ? getEventImage({ imageUrl, category }) : getSchemeImage({ imageUrl, category });
  if (isValidHttpUrl(imageUrl)) return imageUrl;
  if (fallback) return fallback;
  return coverPlaceholder({ title, category, state, sourceType, type });
}

export default getSchemeImage;
