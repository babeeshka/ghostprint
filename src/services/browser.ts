import 'dotenv/config';
import { chromium } from 'playwright';
import type { BrowserContext, Page } from 'playwright';
import { randomInt, sleep } from './randomizer.js';

let activeBrowserContext: BrowserContext | null = null;

export async function launchBrowser(): Promise<BrowserContext> {
  if (activeBrowserContext) {
    throw new Error('Browser context already active — call closeBrowser() first');
  }

  const userDataDir = process.env.CHROME_USER_DATA_DIR;
  const profileName = process.env.CHROME_PROFILE_NAME ?? 'Default';

  if (!userDataDir) {
    throw new Error('CHROME_USER_DATA_DIR is not set in your .env file');
  }

  activeBrowserContext = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: process.env.HEADLESS === 'true',
    args: [`--profile-directory=${profileName}`],
    viewport: null,
  });

  return activeBrowserContext;
}

export async function closeBrowser(): Promise<void> {
  if (!activeBrowserContext) return;
  await activeBrowserContext.close().catch(err =>
    console.error('Error closing browser context:', err)
  );
  activeBrowserContext = null;
}

export interface QueryResult {
  text: string;
  category: string;
  googleUrl: string;
  firedAt: Date;
  pageTitleAfter?: string;
  loadTimeMs?: number;
  dwellMs: number;
  clickedResultUrl?: string;
  success: boolean;
  errorMsg?: string;
}

export async function fireQuery(
  context: BrowserContext,
  queryText: string,
  category: string,
): Promise<QueryResult> {
  const minDwell = parseInt(process.env.MIN_DWELL_MS ?? '4000', 10);
  const maxDwell = parseInt(process.env.MAX_DWELL_MS ?? '12000', 10);

  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(queryText)}`;
  const firedAt = new Date();
  const page = await context.newPage();

  try {
    const loadStart = Date.now();
    await page.goto(googleUrl, { waitUntil: 'networkidle', timeout: 30000 });
    const loadTimeMs = Date.now() - loadStart;
    const pageTitleAfter = await page.title();

    const scrollCount = randomInt(1, 3);
    for (let i = 0; i < scrollCount; i++) {
      const dist = randomInt(300, 700);
      await page.evaluate((d: number) => window.scrollBy(0, d), dist);
      await sleep(randomInt(500, 1500));
    }

    let clickedResultUrl: string | undefined;
    if (Math.random() < 0.3) {
      clickedResultUrl = await tryClickOrganicResult(page);
    }

    const dwellMs = randomInt(minDwell, maxDwell);
    await sleep(dwellMs);

    return {
      text: queryText,
      category,
      googleUrl,
      firedAt,
      pageTitleAfter,
      loadTimeMs,
      dwellMs,
      clickedResultUrl,
      success: true,
    };
  } catch (error) {
    return {
      text: queryText,
      category,
      googleUrl,
      firedAt,
      dwellMs: 0,
      success: false,
      errorMsg: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function tryClickOrganicResult(page: Page): Promise<string | undefined> {
  try {
    const links = await page.evaluate((): string[] => {
      const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      return anchors
        .map(a => a.href)
        .filter(
          href =>
            href.startsWith('http') &&
            !href.includes('google.com') &&
            !href.includes('javascript:')
        )
        .slice(0, 5);
    });

    if (links.length === 0) return undefined;

    const target = links[Math.floor(Math.random() * links.length)];
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(randomInt(2000, 5000));
    return target;
  } catch {
    return undefined;
  }
}
