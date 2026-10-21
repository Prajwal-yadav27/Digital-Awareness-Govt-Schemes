# Image Asset Manifest — GovSchemes Portal

All runtime images are local files in this directory (served as `/images/...`).
No external image URLs are used at runtime. Card components fall back:
DB `imageUrl` → local category image below → built-in SVG placeholder.

## Hero & editorial

| File | Use | Source / Licence |
|---|---|---|
| `hero-farmer.jpg` (243 KB, 1600px) | Landing hero, photographic panel | Pexels photo 5459139 “Senior Indian man in field” (mustard field, turban). Pexels License (free use, no attribution required). Download params `auto=compress&cs=tinysrgb&w=1600`. |
| `government-hero.webp` (423 KB) | Auth brand panels, About purpose visual | Pre-existing repo asset (civic monument, neutral, no seals/partisanship). |
| `government-hero-alt.jpg`, `government-bg.webp`, `government-cinematic-bg.webp`, `government-cinematic-bg2.webp`, `admin-government-bg.webp` | Legacy approved assets, currently unused by components | Pre-existing repo assets, retained. |

## Category fallbacks (640px cards)

Vendored bytes of the repo's previously curated Unsplash photo IDs
(Unsplash License; same curation, now zero hotlink risk):

| File | Categories |
|---|---|
| `card-agriculture.jpg` | Agriculture |
| `card-education.jpg` | Education |
| `card-healthcare.jpg` | Healthcare, Health |
| `card-housing.jpg` | Housing, Housing & Urban, Infrastructure |
| `card-employment.jpg` | Employment |
| `card-women-child.jpg` | Women & Child |
| `card-finance.jpg` | Finance, Financial |
| `card-welfare.jpg` | Social Welfare, Welfare |
| `card-technology.jpg` | Technology |
| `card-sports.jpg` | Sports |
| `card-default.jpg` | Default, Transport (see note), unknown |
| `card-event-health.jpg` | Event: Health |
| `card-event-education.jpg` | Event: Education |
| `card-event.jpg` | Event default, Skill Development, Awareness |

Note: the former Transport CDN URL no longer resolves (verified with
retries on 2026-10-13), so Transport maps to the neutral default rather
than a dead link. `hero-agriculture.jpg` (previous hero) was removed to
avoid shipping an unused 403 KB asset.
