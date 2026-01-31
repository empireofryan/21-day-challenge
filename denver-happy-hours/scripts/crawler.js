#!/usr/bin/env node
/**
 * SUBAGENT 2 - Crawler
 * For each venue with a website, fetch the homepage plus any pages
 * with "happy", "special", "menu", "drinks" in the URL path.
 * Save raw text per venue to data/raw/.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const VENUES_FILE = path.join(DATA_DIR, 'venues.json');

const INTERESTING_KEYWORDS = ['happy', 'special', 'menu', 'drink', 'hour', 'deal', 'promo', 'offer', 'food'];
const MAX_PAGES_PER_VENUE = 5;
const PAGE_TIMEOUT = 15000;

function ensureDirs() {
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }
}

function loadVenues() {
  if (!fs.existsSync(VENUES_FILE)) {
    console.error('venues.json not found. Run scraper.js first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(VENUES_FILE, 'utf-8'));
}

async function extractPageText(page) {
  try {
    return await page.evaluate(() => {
      // Remove script, style, nav, footer elements for cleaner text
      const clone = document.body.cloneNode(true);
      const removeTags = ['script', 'style', 'noscript', 'svg', 'iframe'];
      removeTags.forEach(tag => {
        clone.querySelectorAll(tag).forEach(el => el.remove());
      });
      return clone.innerText || clone.textContent || '';
    });
  } catch {
    return '';
  }
}

async function findRelevantLinks(page, baseUrl) {
  try {
    const links = await page.evaluate((keywords) => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().toLowerCase() }))
        .filter(link => {
          const lowerHref = link.href.toLowerCase();
          const lowerText = link.text;
          return keywords.some(kw => lowerHref.includes(kw) || lowerText.includes(kw));
        })
        .map(link => link.href);
    }, INTERESTING_KEYWORDS);

    // Deduplicate and filter to same domain
    const base = new URL(baseUrl);
    const unique = [...new Set(links)].filter(href => {
      try {
        const u = new URL(href);
        return u.hostname === base.hostname || u.hostname.endsWith('.' + base.hostname);
      } catch {
        return false;
      }
    });

    return unique.slice(0, MAX_PAGES_PER_VENUE);
  } catch {
    return [];
  }
}

async function crawlVenue(browser, venue) {
  if (!venue.website) {
    console.log(`  Skipping ${venue.name} (no website)`);
    fs.writeFileSync(
      path.join(RAW_DIR, `${venue.id}.txt`),
      `Venue: ${venue.name}\nAddress: ${venue.address}\nNeighborhood: ${venue.neighborhood}\nWebsite: none\n\nNo website available for crawling.\n`
    );
    return;
  }

  const outputFile = path.join(RAW_DIR, `${venue.id}.txt`);
  let allText = `Venue: ${venue.name}\nAddress: ${venue.address}\nNeighborhood: ${venue.neighborhood}\nWebsite: ${venue.website}\n\n`;

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(PAGE_TIMEOUT);

  try {
    // Fetch homepage
    console.log(`  Fetching homepage: ${venue.website}`);
    await page.goto(venue.website, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
    await page.waitForTimeout(2000);

    const homeText = await extractPageText(page);
    allText += `=== HOMEPAGE ===\n${homeText}\n\n`;

    // Find and fetch relevant subpages
    const relevantLinks = await findRelevantLinks(page, venue.website);
    console.log(`  Found ${relevantLinks.length} relevant subpages`);

    for (const link of relevantLinks) {
      try {
        console.log(`    Fetching: ${link}`);
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
        await page.waitForTimeout(1000);
        const subText = await extractPageText(page);
        allText += `=== ${link} ===\n${subText}\n\n`;
      } catch (err) {
        allText += `=== ${link} ===\nFailed to fetch: ${err.message}\n\n`;
      }
    }
  } catch (err) {
    allText += `Failed to fetch homepage: ${err.message}\n`;
    console.log(`  Error fetching ${venue.name}: ${err.message}`);
  } finally {
    await context.close();
  }

  fs.writeFileSync(outputFile, allText);
  console.log(`  Saved ${outputFile} (${allText.length} chars)`);
}

async function main() {
  console.log('=== Denver Happy Hour Crawler ===\n');
  ensureDirs();

  const venues = loadVenues();
  console.log(`Loaded ${venues.length} venues from venues.json\n`);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    for (const venue of venues) {
      console.log(`\nCrawling: ${venue.name}`);
      await crawlVenue(browser, venue);
    }
  } catch (err) {
    console.error('Browser launch failed:', err.message);
    console.log('\nFalling back to generating placeholder raw text files...');
    generateFallbackRawFiles(venues);
  } finally {
    if (browser) await browser.close();
  }

  console.log('\n=== Crawling complete ===');
  const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.txt'));
  console.log(`Generated ${files.length} raw text files in data/raw/`);
}

function generateFallbackRawFiles(venues) {
  for (const venue of venues) {
    const outputFile = path.join(RAW_DIR, `${venue.id}.txt`);
    let text = `Venue: ${venue.name}\nAddress: ${venue.address}\nNeighborhood: ${venue.neighborhood}\nWebsite: ${venue.website || 'none'}\n\n`;
    text += `Unable to crawl website. No raw text available.\n`;
    fs.writeFileSync(outputFile, text);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
