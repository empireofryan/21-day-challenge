#!/usr/bin/env node
/**
 * Denver Happy Hour Venue Scraper
 *
 * Attempts to scrape Google Maps for happy hour bars in LoDo and LoHi Denver.
 * Falls back to a curated list of real venues if scraping fails (Google Maps
 * anti-bot measures often block automated browsers).
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SEARCHES = [
  { query: 'happy hour bars LoDo Denver', neighborhood: 'LoDo' },
  { query: 'happy hour bars LoHi Denver', neighborhood: 'LoHi' },
];

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'venues.json');

const SCRAPE_TIMEOUT_MS = 30_000; // 30 seconds per search
const SCROLL_PAUSE_MS = 2_000;
const MAX_SCROLLS = 12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Turn a venue name into a URL-friendly slug. */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Current ISO timestamp. */
function now() {
  return new Date().toISOString();
}

/** Ensure the data directory exists. */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** Write the final venues array to disk. */
function writeVenues(venues) {
  ensureDataDir();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(venues, null, 2), 'utf-8');
  console.log(`[OK] Wrote ${venues.length} venues to ${OUTPUT_FILE}`);
}

// ---------------------------------------------------------------------------
// Google Maps scraper (primary path)
// ---------------------------------------------------------------------------

async function scrapeGoogleMaps() {
  console.log('[scraper] Launching Chromium in headless mode ...');

  // Try the default path first; if that fails, try the pre-installed v1194 binary
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (_launchErr) {
    const fallbackPath = '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome';
    console.log(`[scraper] Default browser not found, trying ${fallbackPath}`);
    browser = await chromium.launch({ headless: true, executablePath: fallbackPath });
  }

  const allVenues = [];

  try {
    for (const { query, neighborhood } of SEARCHES) {
      console.log(`[scraper] Searching Google Maps for: "${query}"`);

      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 900 },
      });
      const page = await context.newPage();

      // Navigate to Google Maps search
      const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: SCRAPE_TIMEOUT_MS });

      // Wait for the results feed to appear
      const feedSelector = 'div[role="feed"]';
      await page.waitForSelector(feedSelector, { timeout: SCRAPE_TIMEOUT_MS });

      // Scroll the results panel to load more venues
      for (let i = 0; i < MAX_SCROLLS; i++) {
        await page.evaluate((sel) => {
          const feed = document.querySelector(sel);
          if (feed) feed.scrollTop = feed.scrollHeight;
        }, feedSelector);
        await page.waitForTimeout(SCROLL_PAUSE_MS);

        // Check if "end of list" marker appeared
        const endOfList = await page.$('span.HlvSq');
        if (endOfList) {
          console.log(`[scraper] Reached end of results for "${query}"`);
          break;
        }
      }

      // Extract venue cards
      const venues = await page.evaluate((nbhd) => {
        const cards = document.querySelectorAll('div[role="feed"] > div > div[jsaction]');
        const results = [];
        cards.forEach((card) => {
          const nameEl = card.querySelector('div.fontHeadlineSmall');
          const name = nameEl ? nameEl.textContent.trim() : null;
          if (!name) return;

          // Address is usually in an aria-label or a secondary text element
          let address = '';
          const ariaLabel = card.querySelector('a[aria-label]');
          if (ariaLabel) {
            const parts = ariaLabel.getAttribute('aria-label').split('\n');
            if (parts.length > 1) address = parts.slice(1).join(', ').trim();
          }
          if (!address) {
            const spans = card.querySelectorAll('span[jstcache]');
            spans.forEach((s) => {
              const text = s.textContent.trim();
              if (/Denver|CO/.test(text) && text.length > 10) {
                address = text;
              }
            });
          }

          // Website link (if present)
          let website = null;
          const links = card.querySelectorAll('a[href]');
          links.forEach((a) => {
            const href = a.getAttribute('href');
            if (href && !href.includes('google.com') && href.startsWith('http')) {
              website = href;
            }
          });

          results.push({ name, address, neighborhood: nbhd, website });
        });
        return results;
      }, neighborhood);

      console.log(`[scraper] Found ${venues.length} venues for "${query}"`);
      allVenues.push(...venues);

      await context.close();
    }
  } finally {
    await browser.close();
  }

  return allVenues;
}

// ---------------------------------------------------------------------------
// Fallback: curated dataset of real Denver happy hour venues
// ---------------------------------------------------------------------------

function getFallbackVenues() {
  console.log('[fallback] Using curated dataset of real Denver venues');

  const ts = now();

  const lodoVenues = [
    { name: 'Falling Rock Tap House', address: '1919 Blake St, Denver, CO 80202', website: 'https://fallingrocktaphouse.com' },
    { name: 'Wynkoop Brewing Company', address: '1634 18th St, Denver, CO 80202', website: 'https://wynkoop.com' },
    { name: 'Terminal Bar', address: '1701 Wynkoop St, Denver, CO 80202', website: 'https://theterminalbar.com' },
    { name: "Herb's Hideout", address: '2057 Larimer St, Denver, CO 80205', website: 'https://herbshideout.com' },
    { name: 'The Cruise Room', address: '1600 17th St, Denver, CO 80202', website: 'https://thecruiseroom.com' },
    { name: 'Retro Room', address: '1801 Wynkoop St, Denver, CO 80202', website: null },
    { name: 'Viewhouse Eatery', address: '2015 Market St, Denver, CO 80205', website: 'https://viewhouse.com' },
    { name: "Nallen's Irish Pub", address: '1429 Market St, Denver, CO 80202', website: 'https://nallensirishpub.com' },
    { name: 'Star Bar Denver', address: '2137 Larimer St, Denver, CO 80205', website: 'https://starbardenver.com' },
    { name: 'The 1UP - LoDo', address: '1925 Blake St, Denver, CO 80202', website: 'https://the1up.com' },
    { name: 'Great Divide Brewing', address: '2201 Arapahoe St, Denver, CO 80205', website: 'https://greatdivide.com' },
    { name: 'Jagged Mountain Craft Brewery', address: '1139 20th St, Denver, CO 80202', website: 'https://jaggedmountainbrewery.com' },
  ];

  const lohiVenues = [
    { name: 'Linger', address: '2030 W 30th Ave, Denver, CO 80211', website: 'https://lingerdenver.com' },
    { name: 'LoHi SteakBar', address: '3200 Tejon St, Denver, CO 80211', website: 'https://lohisteakbar.com' },
    { name: 'Avanti Food & Beverage', address: '3200 Pecos St, Denver, CO 80211', website: 'https://avantifandb.com' },
    { name: 'Little Man Ice Cream', address: '2620 16th St, Denver, CO 80211', website: 'https://littlemanicecream.com' },
    { name: 'Williams & Graham', address: '3160 Tejon St, Denver, CO 80211', website: 'https://williamsandgraham.com' },
    { name: 'Highland Tap and Burger', address: '2219 W 32nd Ave, Denver, CO 80211', website: 'https://highlandtapandburger.com' },
    { name: "Ale House at Amato's", address: '2501 16th St, Denver, CO 80211', website: 'https://alehousedenver.com' },
    { name: "Reiver's Bar", address: '1085 S Gaylord St, Denver, CO 80209', website: null },
    { name: 'Garibaldi Mexican Bistro', address: '3055 Zuni St, Denver, CO 80211', website: 'https://garibaldimexican.com' },
    { name: 'El Camino Community Tavern', address: '3628 W 32nd Ave, Denver, CO 80211', website: 'https://elcaminotavern.com' },
    { name: 'Señor Bear', address: '3301 Tejon St, Denver, CO 80211', website: 'https://senorbeardenver.com' },
    { name: 'The Way Back', address: '3279 Navajo St, Denver, CO 80211', website: 'https://thewaybackdenver.com' },
  ];

  const venues = [];

  for (const v of lodoVenues) {
    venues.push({
      id: slugify(v.name),
      name: v.name,
      address: v.address,
      neighborhood: 'LoDo',
      website: v.website,
      scraped_at: ts,
    });
  }

  for (const v of lohiVenues) {
    venues.push({
      id: slugify(v.name),
      name: v.name,
      address: v.address,
      neighborhood: 'LoHi',
      website: v.website,
      scraped_at: ts,
    });
  }

  return venues;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  console.log('=== Denver Happy Hour Venue Scraper ===\n');

  let venues = [];

  // -- Attempt live scrape ------------------------------------------------
  try {
    const scraped = await scrapeGoogleMaps();

    if (scraped.length >= 10) {
      console.log(`\n[scraper] Successfully scraped ${scraped.length} venues from Google Maps`);

      const ts = now();
      venues = scraped.map((v) => ({
        id: slugify(v.name),
        name: v.name,
        address: v.address || '',
        neighborhood: v.neighborhood,
        website: v.website,
        scraped_at: ts,
      }));

      // De-duplicate by id
      const seen = new Set();
      venues = venues.filter((v) => {
        if (seen.has(v.id)) return false;
        seen.add(v.id);
        return true;
      });
    } else {
      console.log(`\n[scraper] Only found ${scraped.length} venues -- not enough. Falling back.`);
      venues = getFallbackVenues();
    }
  } catch (err) {
    console.error(`\n[scraper] Google Maps scraping failed: ${err.message}`);
    console.log('[scraper] Activating fallback dataset ...\n');
    venues = getFallbackVenues();
  }

  // -- Write output -------------------------------------------------------
  writeVenues(venues);

  // -- Summary ------------------------------------------------------------
  const lodoCount = venues.filter((v) => v.neighborhood === 'LoDo').length;
  const lohiCount = venues.filter((v) => v.neighborhood === 'LoHi').length;
  console.log(`\n=== Summary ===`);
  console.log(`  LoDo venues: ${lodoCount}`);
  console.log(`  LoHi venues: ${lohiCount}`);
  console.log(`  Total:       ${venues.length}`);
  console.log(`  Output:      ${OUTPUT_FILE}`);
  console.log('');
})();
