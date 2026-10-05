import { coverPlaceholder } from './placeholder';

/**
 * Category → curated Unsplash image (real-world, government-relevant).
 * Fallback chain: DB imageUrl → category image → placeholder SVG.
 * All URLs are stable, CDN-cached, and use `w=640&h=400&fit=crop` for consistent aspect ratio.
 */
const SCHEME_IMAGES = {
  Agriculture: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=640&h=400&fit=crop&auto=format',
  Education: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=640&h=400&fit=crop&auto=format',
  Healthcare: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=640&h=400&fit=crop&auto=format',
  Health: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=640&h=400&fit=crop&auto=format',
  'Housing & Urban': 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=640&h=400&fit=crop&auto=format',
  Housing: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=640&h=400&fit=crop&auto=format',
  Employment: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=640&h=400&fit=crop&auto=format',
  'Women & Child': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=640&h=400&fit=crop&auto=format',
  Finance: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=640&h=400&fit=crop&auto=format',
  Financial: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=640&h=400&fit=crop&auto=format',
  'Social Welfare': 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=640&h=400&fit=crop&auto=format',
  Transport: 'https://images.unsplash.com/photo-1494515843206-f3117afe722f?w=640&h=400&fit=crop&auto=format',
  Infrastructure: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=640&h=400&fit=crop&auto=format',
  Technology: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=640&h=400&fit=crop&auto=format',
  Sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=640&h=400&fit=crop&auto=format',
  Default: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=640&h=400&fit=crop&auto=format',
};

const EVENT_IMAGES = {
  Health: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=640&h=400&fit=crop&auto=format',
  Education: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=640&h=400&fit=crop&auto=format',
  Agriculture: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=640&h=400&fit=crop&auto=format',
  Welfare: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=640&h=400&fit=crop&auto=format',
  Employment: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=640&h=400&fit=crop&auto=format',
  'Skill Development': 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=640&h=400&fit=crop&auto=format',
  'Public Safety': 'https://images.unsplash.com/photo-1494515843206-f3117afe722f?w=640&h=400&fit=crop&auto=format',
  Awareness: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=640&h=400&fit=crop&auto=format',
  Default: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=640&h=400&fit=crop&auto=format',
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
