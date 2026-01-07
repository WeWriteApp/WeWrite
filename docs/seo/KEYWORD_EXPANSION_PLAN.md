# WeWrite Keyword Expansion Plan

## Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Keyword Database | ✅ COMPLETED | Centralized `seo-keywords.ts` with 500+ keywords |
| Phase 2: Landing Verticals | ✅ COMPLETED | 23 total verticals (8 original + 15 new) |
| Phase 3: Topic Pages | ✅ COMPLETED | 75 topics (up from 20) |
| Phase 4: Use Case Pages | ✅ COMPLETED | 16 programmatic `/for/[usecase]` pages |
| Phase 5: Comparison Pages | ✅ COMPLETED | 5 `/compare/[competitor]` pages |
| Phase 6: FAQ Expansion | ✅ COMPLETED | 10 FAQs with Schema.org structured data |

---

## Overview

This plan outlines how to significantly expand WeWrite's keyword coverage to capture more search traffic across all use cases, verticals, and user intents.

## Current State (After Implementation)

### Keywords Structure
- **Root layout** (`app/layout.tsx`): 35 keywords (up from 10)
- **23 landing verticals** (`app/constants/landing-verticals.ts`): 15-19 keywords each
- **75 topic pages**: Rich keyword sets per topic
- **16 use case pages**: Targeted long-tail keywords
- **5 comparison pages**: Competitor comparison keywords
- **10 FAQ items**: With Schema.org FAQPage markup

### Total Keyword Coverage
- **Estimated 1000+ unique keywords** across all pages
- Long-tail searches like "software for collaborative citizen journalism"
- Comparison searches like "WeWrite vs Medium"
- Use-case specific searches

---

## Implemented Changes

### Phase 1: Comprehensive Keyword Database ✅

**File: `app/constants/seo-keywords.ts`**

Created centralized keyword database organized by:

#### A. Use Case Keywords
- Publishing, monetization, collaboration, alternatives

#### B. Audience/Persona Keywords
- Writers, journalists, educators, political writers, researchers, critics, creators

#### C. Problem/Solution Keywords
- Algorithm issues, paywalls, fees, ownership, censorship concerns

#### D. Feature Keywords
- Collaboration, monetization, publishing, community features

#### E. Comparison Keywords
- Medium, Substack, Ghost, WordPress, Patreon comparisons

#### F. Long-tail Use Case Keywords
- Citizen journalism, creative writing, education, niche expertise, newsletters

#### G. Topic-Specific Keywords
- 25+ topic categories with 6-8 keywords each

---

### Phase 2: Expanded Landing Verticals ✅

**File: `app/constants/landing-verticals.ts`**

**Original verticals (enhanced with more keywords):**
1. General
2. Writers
3. Journalists
4. Homeschoolers
5. Political Debaters
6. Researchers
7. Film Critics
8. Food Critics

**New verticals added:**
9. Teachers
10. Newsletter Writers
11. Fiction Writers
12. Poets
13. Local News Writers
14. Academics
15. Tutorial Writers (How-To Creators)
16. Product Reviewers
17. Sports Writers
18. Tech Writers
19. Travel Writers
20. Health Writers
21. Finance Writers
22. Parenting Writers
23. Faith Writers

Each vertical now has 15-19 targeted keywords.

---

### Phase 3: Topic Page Enhancement ✅

**File: `app/topics/[topic]/page.tsx`**

Expanded from 20 to 75 topics:

**Original topics:** technology, writing, creativity, business, personal, tutorial, philosophy, science, art, music, travel, food, health, education, finance, lifestyle, productivity, programming, design, marketing

**New topics added:**
- politics, entertainment, sports, parenting, relationships
- spirituality, gaming, diy, photography, pets
- currentEvents, opinion, tutorials, reviews, history
- environment, news, journalism, fiction, poetry
- essays, memoir, selfImprovement, mentalHealth, fitness
- nutrition, cooking, homeImprovement, gardening, crafts
- startups, entrepreneurship, investing, cryptocurrency, economics
- law, medicine, engineering, mathematics, psychology
- sociology, anthropology, linguistics, literature, film
- television, theater, dance, fashion, beauty
- automotive, aviation, military, space, outdoors

Each topic has custom display name, description, and keyword set.

---

### Phase 4: Programmatic Use Case Pages ✅

**Files:**
- `app/constants/seo-usecases.ts` - Use case configuration
- `app/for/[usecase]/page.tsx` - Dynamic page component

**16 use case landing pages created:**

| URL | Target Audience |
|-----|-----------------|
| `/for/citizen-journalism` | Community reporters, activists |
| `/for/local-news` | Local journalists, community bloggers |
| `/for/independent-media` | Independent journalists, political writers |
| `/for/creative-writing` | Fiction writers, poets, essayists |
| `/for/academic-publishing` | Professors, researchers, grad students |
| `/for/newsletter-creators` | Newsletter writers, Substack users |
| `/for/tutorial-writers` | How-to creators, educators |
| `/for/product-reviewers` | Tech reviewers, consumer advocates |
| `/for/travel-blogging` | Travel bloggers, destination writers |
| `/for/tech-blogging` | Developers, tech writers |
| `/for/sports-commentary` | Sports writers, analysts |
| `/for/food-blogging` | Food bloggers, restaurant critics |
| `/for/parenting-content` | Parent bloggers, family writers |
| `/for/faith-based-writing` | Faith writers, ministry leaders |
| `/for/health-wellness` | Health writers, wellness coaches |
| `/for/financial-content` | Finance writers, investment analysts |

Each page includes:
- Custom hero with targeted H1
- Benefits section
- Target audience chips
- How it works section
- CTA sections
- Schema.org SoftwareApplication markup
- Related vertical links

---

### Phase 5: Comparison Pages ✅

**Files:**
- `app/constants/seo-comparisons.ts` - Comparison configuration
- `app/compare/[competitor]/page.tsx` - Dynamic page component

**5 competitor comparison pages created:**

| URL | Competitor | Key Differentiators |
|-----|------------|---------------------|
| `/compare/medium` | Medium | No paywall, direct earnings, algorithm-free |
| `/compare/substack` | Substack | Lower fees, flexible monetization, web presence |
| `/compare/ghost` | Ghost | Zero setup, fully managed, built-in monetization |
| `/compare/wordpress` | WordPress | No maintenance, always secure, simple |
| `/compare/patreon` | Patreon | Built for writers, public by default, flexible support |

Each comparison page includes:
- Feature comparison table
- Key advantages section
- "Ideal For" audience chips
- Links to other comparison pages
- Schema.org structured data

---

### Phase 6: FAQ Schema Expansion ✅

**File: `app/components/landing/LandingPage.tsx`**

Expanded from 2 FAQs to 10 FAQs with Schema.org FAQPage markup:

1. How does WeWrite work?
2. How do I get paid on WeWrite?
3. Is WeWrite free to use?
4. What can I write about on WeWrite?
5. How is WeWrite different from Medium?
6. How do I install WeWrite as an app?
7. Can I import my existing content?
8. Can I collaborate with other writers?
9. Is WeWrite backed by investors?
10. What percentage does WeWrite take?

Added `FAQPage` Schema.org structured data for Google rich snippets.

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `app/constants/seo-keywords.ts` | ✅ NEW | Centralized keyword database (500+ keywords) |
| `app/constants/seo-usecases.ts` | ✅ NEW | Use case page configuration (16 use cases) |
| `app/constants/seo-comparisons.ts` | ✅ NEW | Competitor comparison configuration (5 competitors) |
| `app/constants/landing-verticals.ts` | ✅ MODIFIED | Added 15 new verticals, enhanced keywords |
| `app/layout.tsx` | ✅ MODIFIED | Expanded root keywords (10 → 35) |
| `app/for/[usecase]/page.tsx` | ✅ NEW | Programmatic use-case pages |
| `app/compare/[competitor]/page.tsx` | ✅ NEW | Competitor comparison pages |
| `app/topics/[topic]/page.tsx` | ✅ MODIFIED | Expanded topics (20 → 75), enhanced keywords |
| `app/components/landing/LandingPage.tsx` | ✅ MODIFIED | Expanded FAQ (2 → 10), added Schema.org markup |

---

## Expected Outcomes

1. **10x keyword coverage** - From ~100 keywords to 1000+
2. **Long-tail traffic** - Capture specific searches like "software for collaborative citizen journalism"
3. **Comparison traffic** - Rank for "X vs Y" searches
4. **Use-case traffic** - Rank for specific professional needs
5. **FAQ rich snippets** - Appear in Google's "People also ask"
6. **Vertical traffic** - 23 targeted landing pages for different audiences

---

## New Routes Added

```
/for/citizen-journalism
/for/local-news
/for/independent-media
/for/creative-writing
/for/academic-publishing
/for/newsletter-creators
/for/tutorial-writers
/for/product-reviewers
/for/travel-blogging
/for/tech-blogging
/for/sports-commentary
/for/food-blogging
/for/parenting-content
/for/faith-based-writing
/for/health-wellness
/for/financial-content

/compare/medium
/compare/substack
/compare/ghost
/compare/wordpress
/compare/patreon

/welcome/teachers
/welcome/newsletter-writers
/welcome/fiction-writers
/welcome/poets
/welcome/local-news
/welcome/academics
/welcome/how-to-creators
/welcome/reviewers
/welcome/sports-writers
/welcome/tech-writers
/welcome/travel-writers
/welcome/health-writers
/welcome/finance-writers
/welcome/parenting-writers
/welcome/faith-writers

/topics/[75 topics]
```

---

## Notes

- All new pages include proper canonical URLs
- Each page has unique, non-duplicate content
- Schema.org structured data added for rich snippets
- Internal linking between related pages implemented
- Build verified successful with all new routes
