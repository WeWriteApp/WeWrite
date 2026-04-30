#!/usr/bin/env node

/**
 * Lightweight SEO + GEO health audit for WeWrite.
 *
 * Usage:
 *   bun run seo:audit
 *   bun run seo:audit --baseUrl=https://www.getwewrite.app
 *   bun run seo:audit --baseUrl=http://localhost:3000 --pageId=<content-page-id>
 */

const args = process.argv.slice(2);
const baseArg = args.find((arg) => arg.startsWith('--baseUrl='));
const pageArg = args.find((arg) => arg.startsWith('--pageId='));

const baseUrl = (baseArg ? baseArg.split('=')[1] : process.env.SEO_AUDIT_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const pageId = pageArg ? pageArg.split('=')[1] : '';

const checks = [];

async function fetchText(path) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'WeWrite-SEO-Audit/1.0',
      'Accept': 'text/html,application/xml,text/plain,*/*'
    }
  });
  const body = await res.text();
  return { url, res, body };
}

function addCheck(name, pass, details) {
  checks.push({ name, pass, details });
}

async function run() {
  console.log(`SEO/GEO audit base URL: ${baseUrl}`);

  try {
    const robots = await fetchText('/robots.txt');
    addCheck(
      'robots.txt reachable',
      robots.res.ok,
      `${robots.res.status} ${robots.res.statusText}`
    );
    addCheck(
      'robots references pages sitemap index',
      robots.body.includes('/api/sitemap-pages-index'),
      'Expected /api/sitemap-pages-index in robots sitemap list'
    );
  } catch (error) {
    addCheck('robots.txt reachable', false, error.message);
  }

  try {
    const sitemapIndex = await fetchText('/api/sitemap-index');
    const type = sitemapIndex.res.headers.get('content-type') || '';
    const xRobots = sitemapIndex.res.headers.get('x-robots-tag') || '';

    addCheck('api/sitemap-index reachable', sitemapIndex.res.ok, `${sitemapIndex.res.status} ${sitemapIndex.res.statusText}`);
    addCheck('api/sitemap-index returns xml content-type', type.includes('xml'), type || 'missing content-type');
    addCheck('api/sitemap-index is noindex', xRobots.toLowerCase().includes('noindex'), xRobots || 'missing x-robots-tag');
    addCheck('api/sitemap-index includes pages sitemap index', sitemapIndex.body.includes('/api/sitemap-pages-index'), 'Expected /api/sitemap-pages-index entry');
  } catch (error) {
    addCheck('api/sitemap-index reachable', false, error.message);
  }

  try {
    const pagesIndex = await fetchText('/api/sitemap-pages-index');
    addCheck('api/sitemap-pages-index reachable', pagesIndex.res.ok, `${pagesIndex.res.status} ${pagesIndex.res.statusText}`);
    addCheck('api/sitemap-pages-index includes cursor-paginated page sitemap urls', pagesIndex.body.includes('/api/sitemap-pages?limit='), 'Expected /api/sitemap-pages?limit=... entries');
  } catch (error) {
    addCheck('api/sitemap-pages-index reachable', false, error.message);
  }

  try {
    const searchPage = await fetchText('/search');
    const hasNoIndexMeta = /<meta\s+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(searchPage.body);
    addCheck('search page includes noindex meta', hasNoIndexMeta, 'Expected robots noindex meta tag on /search');
  } catch (error) {
    addCheck('search page includes noindex meta', false, error.message);
  }

  try {
    const authPage = await fetchText('/auth/login');
    const hasNoIndexMeta = /<meta\s+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(authPage.body);
    addCheck('auth page includes noindex meta', hasNoIndexMeta, 'Expected robots noindex meta tag on /auth/login');
  } catch (error) {
    addCheck('auth page includes noindex meta', false, error.message);
  }

  try {
    const llms = await fetchText('/llms.txt');
    addCheck('llms.txt reachable', llms.res.ok, `${llms.res.status} ${llms.res.statusText}`);
    addCheck('llms.txt includes canonical domain guidance', llms.body.includes('https://www.getwewrite.app'), 'Expected canonical domain mention in llms.txt');
  } catch (error) {
    addCheck('llms.txt reachable', false, error.message);
  }

  try {
    const llmsFull = await fetchText('/llms-full.txt');
    addCheck('llms-full.txt reachable', llmsFull.res.ok, `${llmsFull.res.status} ${llmsFull.res.statusText}`);
  } catch (error) {
    addCheck('llms-full.txt reachable', false, error.message);
  }

  if (pageId) {
    try {
      const contentPage = await fetchText(`/${pageId}`);
      const hasCanonical = /<link\s+rel=["']canonical["']/i.test(contentPage.body);
      const hasArticleBody = /itemprop=["']articleBody["']/i.test(contentPage.body);
      addCheck('sample content page canonical tag present', hasCanonical, `Checked /${pageId}`);
      addCheck('sample content page includes server-rendered articleBody', hasArticleBody, `Checked /${pageId}`);
    } catch (error) {
      addCheck('sample content page checks', false, error.message);
    }
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;

  console.log('\nResults:');
  for (const check of checks) {
    const status = check.pass ? 'PASS' : 'FAIL';
    console.log(`- [${status}] ${check.name}: ${check.details}`);
  }

  console.log(`\nSummary: ${passed}/${checks.length} checks passed, ${failed} failed.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('Unexpected SEO audit failure:', error);
  process.exit(1);
});
