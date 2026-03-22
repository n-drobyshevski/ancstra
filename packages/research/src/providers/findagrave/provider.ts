import type {
  SearchProvider,
  SearchRequest,
  SearchResult,
  RecordDetail,
  HealthStatus,
  ProviderType,
} from '../types';
import { RateLimiter } from '../rate-limiter';
import { parseMemorialPage } from './parser';
import type { MemorialData } from './parser';
import * as cheerio from 'cheerio';

const FAG_BASE = 'https://www.findagrave.com';

export class FindAGraveProvider implements SearchProvider {
  readonly id = 'findagrave';
  readonly name = 'Find A Grave';
  readonly type: ProviderType = 'scraper';

  private limiter = new RateLimiter(10);

  async search(query: SearchRequest): Promise<SearchResult[]> {
    try {
      const params = new URLSearchParams();
      if (query.givenName) params.set('firstname', query.givenName);
      if (query.surname) params.set('lastname', query.surname);
      if (query.birthYear) params.set('birthyear', String(query.birthYear));
      if (query.deathYear) params.set('deathyear', String(query.deathYear));
      if (query.location) params.set('location', query.location);

      if (!params.toString()) return [];

      await this.limiter.acquire();
      const res = await fetch(
        `${FAG_BASE}/memorial/search?${params.toString()}`,
        {
          headers: {
            'User-Agent': 'Ancstra Genealogy Research Tool',
            Accept: 'text/html',
          },
        },
      );

      if (!res.ok) return [];

      const html = await res.text();
      return this.parseSearchResults(html);
    } catch {
      return [];
    }
  }

  async getRecord(memorialId: string): Promise<RecordDetail> {
    await this.limiter.acquire();
    const res = await fetch(`${FAG_BASE}/memorial/${memorialId}`, {
      headers: {
        'User-Agent': 'Ancstra Genealogy Research Tool',
        Accept: 'text/html',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch memorial ${memorialId}: ${res.status}`);
    }

    const html = await res.text();
    const data = parseMemorialPage(html);

    return this.mapToRecordDetail(memorialId, data);
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      await this.limiter.acquire();
      const res = await fetch(FAG_BASE, {
        headers: { 'User-Agent': 'Ancstra Genealogy Research Tool' },
      });
      return res.ok ? 'healthy' : 'down';
    } catch {
      return 'down';
    }
  }

  private parseSearchResults(html: string): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $('.memorial-item, .search-result-item, [data-memorial-id]').each(
      (_i, el) => {
        const linkEl = $(el).find('a').first();
        const href = linkEl.attr('href') ?? '';
        const idMatch = href.match(/\/memorial\/(\d+)/);
        if (!idMatch) return;

        const memorialId = idMatch[1];
        const name = linkEl.text().trim() || 'Unknown';

        const dates =
          $(el).find('.memorial-dates, .dates').text().trim() || '';
        const location =
          $(el).find('.memorial-location, .location').text().trim() || '';

        results.push({
          providerId: this.id,
          externalId: memorialId,
          title: name,
          snippet: [dates, location].filter(Boolean).join(' - '),
          url: `${FAG_BASE}/memorial/${memorialId}`,
          recordType: 'cemetery',
          extractedData: {
            name,
            location: location || undefined,
          },
        });
      },
    );

    return results;
  }

  private mapToRecordDetail(
    memorialId: string,
    data: MemorialData,
  ): RecordDetail {
    const metadata: Record<string, string> = {};
    if (data.birthDate) metadata['birthDate'] = data.birthDate;
    if (data.birthPlace) metadata['birthPlace'] = data.birthPlace;
    if (data.deathDate) metadata['deathDate'] = data.deathDate;
    if (data.deathPlace) metadata['deathPlace'] = data.deathPlace;
    if (data.burialCemeteryName)
      metadata['cemetery'] = data.burialCemeteryName;
    if (data.burialCemeteryLocation)
      metadata['cemeteryLocation'] = data.burialCemeteryLocation;

    for (const link of data.familyLinks) {
      const key = `family_${link.relationship}`;
      metadata[key] = link.name;
      if (link.memorialId) {
        metadata[`${key}_id`] = link.memorialId;
      }
    }

    return {
      providerId: this.id,
      externalId: memorialId,
      title: data.name || 'Unknown',
      fullText: data.bio ?? '',
      url: `${FAG_BASE}/memorial/${memorialId}`,
      recordType: 'cemetery',
      metadata,
    };
  }
}
