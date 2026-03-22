import * as cheerio from 'cheerio';

/**
 * Data extracted from a Find A Grave memorial page.
 */
export interface MemorialData {
  name: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  burialCemeteryName?: string;
  burialCemeteryLocation?: string;
  bio?: string;
  familyLinks: FamilyLink[];
}

export interface FamilyLink {
  name: string;
  memorialId?: string;
  relationship: string;
}

/**
 * Parse a Find A Grave memorial page HTML into structured data.
 */
export function parseMemorialPage(html: string): MemorialData {
  const $ = cheerio.load(html);

  const name = $('#bio-name').text().trim() || $('h1').first().text().trim();

  const birthDate = extractDateText($, '#birthDateLabel', '.birthDate');
  const birthPlace = extractPlaceText($, '#birthLocationLabel', '.birthLocation');
  const deathDate = extractDateText($, '#deathDateLabel', '.deathDate');
  const deathPlace = extractPlaceText($, '#deathLocationLabel', '.deathLocation');

  const burialCemeteryName =
    $('#cemeteryNameLabel').text().trim() ||
    $('[data-cemetery-name]').attr('data-cemetery-name') ||
    $('#cemetery-name').text().trim() ||
    undefined;

  const burialCemeteryLocation =
    $('#cemeteryLocationLabel').text().trim() ||
    $('[data-cemetery-location]').text().trim() ||
    undefined;

  const bio =
    $('#annotationBio').text().trim() ||
    $('#bio-text').text().trim() ||
    undefined;

  const familyLinks: FamilyLink[] = [];
  $('#familyLinks li, .family-member').each((_i, el) => {
    const linkEl = $(el).find('a');
    const memberName = linkEl.text().trim() || $(el).text().trim();
    if (!memberName) return;

    const href = linkEl.attr('href') ?? '';
    const memorialIdMatch = href.match(/\/memorial\/(\d+)/);
    const memorialId = memorialIdMatch?.[1];

    const relationshipText =
      $(el).find('.relationship').text().trim() ||
      $(el).attr('data-relationship') ||
      'unknown';

    familyLinks.push({
      name: memberName,
      memorialId,
      relationship: relationshipText,
    });
  });

  return {
    name,
    birthDate: birthDate || undefined,
    birthPlace: birthPlace || undefined,
    deathDate: deathDate || undefined,
    deathPlace: deathPlace || undefined,
    burialCemeteryName,
    burialCemeteryLocation,
    bio,
    familyLinks,
  };
}

function extractDateText(
  $: cheerio.CheerioAPI,
  ...selectors: string[]
): string {
  for (const sel of selectors) {
    const text = $(sel).text().trim();
    if (text) return text;
  }
  return '';
}

function extractPlaceText(
  $: cheerio.CheerioAPI,
  ...selectors: string[]
): string {
  for (const sel of selectors) {
    const text = $(sel).text().trim();
    if (text) return text;
  }
  return '';
}
