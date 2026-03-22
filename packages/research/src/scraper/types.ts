/**
 * Options for scraping a URL.
 */
export interface ScrapeOptions {
  /** URL to scrape */
  url: string;
  /** Timeout in milliseconds (default 30000) */
  timeout?: number;
  /** Optional CSS selector to wait for before extracting */
  waitForSelector?: string;
  /** Whether to extract entity data via AI (deferred to later task) */
  extractEntities?: boolean;
  /** Person ID to associate scraped data with */
  personId?: string;
}

/**
 * Metadata extracted from page meta tags.
 */
export interface PageMetadata {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogSiteName?: string;
  author?: string;
  publishedTime?: string;
  canonical?: string;
}

/**
 * Result of scraping a URL.
 */
export interface ScrapeResult {
  /** Original requested URL */
  url: string;
  /** Final URL after redirects */
  finalUrl: string;
  /** Page title */
  title: string;
  /** Extracted text content (scripts/styles/nav/footer stripped) */
  textContent: string;
  /** Full HTML content */
  html: string;
  /** Extracted metadata from meta tags */
  metadata: PageMetadata;
  /** Timestamp of scrape */
  scrapedAt: Date;
}

/**
 * Screenshot capture options.
 */
export interface ScreenshotOptions {
  /** Capture full page or viewport only (default false) */
  fullPage?: boolean;
  /** Maximum width in pixels; image resized if wider (default 1280) */
  maxWidth?: number;
}

/**
 * Result of archiving scraped content.
 */
export interface ArchiveResult {
  /** Path to archived HTML file */
  htmlPath: string;
  /** Path to archived screenshot PNG */
  screenshotPath: string;
  /** Timestamp of archival */
  archivedAt: Date;
}
