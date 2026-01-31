#!/usr/bin/env node
/**
 * SUBAGENT 3 - Extractor
 * Read each venue's raw text from data/raw/.
 * Extract happy hour info: days, start_time, end_time, food_deals, drink_deals.
 * Output to data/happy_hours.json. Mark "unknown" if not found.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const VENUES_FILE = path.join(DATA_DIR, 'venues.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'happy_hours.json');

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Patterns to detect happy hour times
const TIME_PATTERNS = [
  /(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/gi,
  /happy\s*hour[s]?\s*[:.]?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/gi,
];

const DAY_PATTERNS = [
  /(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)/gi,
  /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*[-–through]+\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
  /daily/gi,
  /every\s*day/gi,
  /weekdays/gi,
  /weekends/gi,
];

const FOOD_PATTERNS = [
  /\$\d+(?:\.\d{2})?\s+(?:off\s+)?(?:appetizer|app|wing|taco|nacho|slider|fries|pizza|burger|bite|snack|plate|food)/gi,
  /half[\s-]?(?:off|price)\s+(?:appetizer|app|food|menu|bite|snack)/gi,
  /(?:appetizer|app|food|bite|snack)s?\s+(?:for\s+)?\$\d+/gi,
  /\$\d+(?:\.\d{2})?\s+(?:taco|wing|slider|pizza|nacho|burger|bite)/gi,
  /(?:free|complimentary)\s+(?:appetizer|food|snack|bite|pizza)/gi,
  /(?:food|kitchen)\s+special/gi,
];

const DRINK_PATTERNS = [
  /\$\d+(?:\.\d{2})?\s+(?:off\s+)?(?:beer|draft|pint|well|cocktail|wine|margarita|marg|shot|drink|spirit|pour|rail|domestic|craft|import|ipa|lager|ale)/gi,
  /half[\s-]?(?:off|price)\s+(?:beer|draft|pint|well|cocktail|wine|drink|bottle|glass)/gi,
  /(?:beer|draft|pint|well|cocktail|wine|margarita|drink|pour)s?\s+(?:for\s+)?\$\d+/gi,
  /\$\d+(?:\.\d{2})?\s+(?:domestic|craft|import|house|select|featured)\s+(?:beer|draft|pint|wine|cocktail)/gi,
  /(?:buy\s+one|bogo)\s+(?:get\s+one\s+)?(?:free|half)/gi,
  /(?:drink|cocktail|beer|wine)\s+special/gi,
];

function normalizeDay(dayStr) {
  const lower = dayStr.toLowerCase().trim();
  for (const day of DAYS_OF_WEEK) {
    if (day.toLowerCase().startsWith(lower.slice(0, 3))) {
      return day;
    }
  }
  return null;
}

function extractDays(text) {
  const lower = text.toLowerCase();
  const days = new Set();

  if (lower.includes('daily') || lower.includes('every day') || lower.includes('7 days')) {
    return [...DAYS_OF_WEEK];
  }
  if (lower.includes('weekday')) {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  }
  if (lower.includes('weekend')) {
    days.add('Saturday');
    days.add('Sunday');
  }

  // Look for day ranges like "Monday-Friday" or "Mon through Fri"
  const rangePattern = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*[-–]?\s*(?:through|thru|to)?\s*[-–]?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi;
  let match;
  while ((match = rangePattern.exec(text)) !== null) {
    const start = normalizeDay(match[1]);
    const end = normalizeDay(match[2]);
    if (start && end) {
      const startIdx = DAYS_OF_WEEK.indexOf(start);
      const endIdx = DAYS_OF_WEEK.indexOf(end);
      if (startIdx >= 0 && endIdx >= 0) {
        for (let i = startIdx; i !== (endIdx + 1) % 7; i = (i + 1) % 7) {
          days.add(DAYS_OF_WEEK[i]);
        }
        days.add(DAYS_OF_WEEK[endIdx]);
      }
    }
  }

  // Look for individual day mentions
  const dayPattern = /\b(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/gi;
  while ((match = dayPattern.exec(text)) !== null) {
    const day = normalizeDay(match[1]);
    if (day) days.add(day);
  }

  return days.size > 0 ? [...days] : null;
}

function normalizeTime(timeStr) {
  if (!timeStr) return null;
  let t = timeStr.trim().toUpperCase();

  // Add :00 if no minutes
  if (/^\d{1,2}(AM|PM)$/i.test(t)) {
    t = t.replace(/(AM|PM)/i, ':00 $1');
  }
  if (/^\d{1,2}\s*(AM|PM)$/i.test(t)) {
    t = t.replace(/(\d+)\s*(AM|PM)/i, '$1:00 $2');
  }

  // Normalize spacing
  t = t.replace(/(\d)(AM|PM)/i, '$1 $2');

  return t;
}

function extractTimes(text) {
  // Look specifically near "happy hour" mentions
  const happyHourContext = text.match(/happy\s*hour[^.]*?(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)/i);
  if (happyHourContext) {
    return {
      start_time: normalizeTime(happyHourContext[1]),
      end_time: normalizeTime(happyHourContext[2]),
    };
  }

  // General time range patterns
  for (const pattern of TIME_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      return {
        start_time: normalizeTime(match[1]),
        end_time: normalizeTime(match[2]),
      };
    }
  }

  return { start_time: null, end_time: null };
}

function extractDeals(text, patterns) {
  const deals = new Set();
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      deals.add(match[0].trim());
    }
  }
  return deals.size > 0 ? [...deals] : null;
}

function extractHappyHourInfo(rawText) {
  if (!rawText || rawText.includes('No website available') || rawText.includes('Unable to crawl')) {
    return {
      days: 'unknown',
      start_time: 'unknown',
      end_time: 'unknown',
      food_deals: 'unknown',
      drink_deals: 'unknown',
    };
  }

  const days = extractDays(rawText);
  const times = extractTimes(rawText);
  const foodDeals = extractDeals(rawText, FOOD_PATTERNS);
  const drinkDeals = extractDeals(rawText, DRINK_PATTERNS);

  return {
    days: days || 'unknown',
    start_time: times.start_time || 'unknown',
    end_time: times.end_time || 'unknown',
    food_deals: foodDeals || 'unknown',
    drink_deals: drinkDeals || 'unknown',
  };
}

function main() {
  console.log('=== Denver Happy Hour Extractor ===\n');

  if (!fs.existsSync(VENUES_FILE)) {
    console.error('venues.json not found. Run scraper.js first.');
    process.exit(1);
  }

  const venues = JSON.parse(fs.readFileSync(VENUES_FILE, 'utf-8'));
  console.log(`Loaded ${venues.length} venues\n`);

  const results = [];

  for (const venue of venues) {
    const rawFile = path.join(RAW_DIR, `${venue.id}.txt`);
    let rawText = '';

    if (fs.existsSync(rawFile)) {
      rawText = fs.readFileSync(rawFile, 'utf-8');
      console.log(`Processing ${venue.name} (${rawText.length} chars of raw text)`);
    } else {
      console.log(`No raw file for ${venue.name} - marking as unknown`);
    }

    const happyHour = extractHappyHourInfo(rawText);

    results.push({
      id: venue.id,
      name: venue.name,
      address: venue.address,
      neighborhood: venue.neighborhood,
      website: venue.website,
      happy_hour: happyHour,
    });

    const status = happyHour.days === 'unknown' ? 'unknown' : 'extracted';
    console.log(`  Status: ${status}`);
    if (status === 'extracted') {
      console.log(`  Days: ${Array.isArray(happyHour.days) ? happyHour.days.join(', ') : happyHour.days}`);
      console.log(`  Time: ${happyHour.start_time} - ${happyHour.end_time}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n=== Extraction complete ===`);
  console.log(`Output saved to ${OUTPUT_FILE}`);

  const extracted = results.filter(r => r.happy_hour.days !== 'unknown').length;
  const unknown = results.filter(r => r.happy_hour.days === 'unknown').length;
  console.log(`Extracted: ${extracted}, Unknown: ${unknown}, Total: ${results.length}`);
}

main();
