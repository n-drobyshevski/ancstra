import { describe, it, expect } from 'vitest';
import { parseMemorialPage } from '../providers/findagrave/parser';

describe('parseMemorialPage', () => {
  it('extracts name, dates, places, and cemetery from memorial HTML', () => {
    const html = `
      <html>
        <body>
          <h1 id="bio-name">John Smith</h1>
          <span id="birthDateLabel">15 Mar 1820</span>
          <span id="birthLocationLabel">Boston, Massachusetts</span>
          <span id="deathDateLabel">22 Nov 1890</span>
          <span id="deathLocationLabel">New York, New York</span>
          <span id="cemeteryNameLabel">Green-Wood Cemetery</span>
          <span id="cemeteryLocationLabel">Brooklyn, New York</span>
          <div id="annotationBio">John Smith was a prominent merchant.</div>
          <ul id="familyLinks">
            <li>
              <a href="/memorial/12345/jane-smith">Jane Smith</a>
              <span class="relationship">Spouse</span>
            </li>
            <li>
              <a href="/memorial/67890/james-smith">James Smith</a>
              <span class="relationship">Child</span>
            </li>
          </ul>
        </body>
      </html>
    `;

    const result = parseMemorialPage(html);

    expect(result.name).toBe('John Smith');
    expect(result.birthDate).toBe('15 Mar 1820');
    expect(result.birthPlace).toBe('Boston, Massachusetts');
    expect(result.deathDate).toBe('22 Nov 1890');
    expect(result.deathPlace).toBe('New York, New York');
    expect(result.burialCemeteryName).toBe('Green-Wood Cemetery');
    expect(result.burialCemeteryLocation).toBe('Brooklyn, New York');
    expect(result.bio).toBe('John Smith was a prominent merchant.');
    expect(result.familyLinks).toHaveLength(2);
    expect(result.familyLinks[0]).toEqual({
      name: 'Jane Smith',
      memorialId: '12345',
      relationship: 'Spouse',
    });
    expect(result.familyLinks[1]).toEqual({
      name: 'James Smith',
      memorialId: '67890',
      relationship: 'Child',
    });
  });

  it('handles missing fields gracefully', () => {
    const html = `
      <html>
        <body>
          <h1>Mary Unknown</h1>
        </body>
      </html>
    `;

    const result = parseMemorialPage(html);

    expect(result.name).toBe('Mary Unknown');
    expect(result.birthDate).toBeUndefined();
    expect(result.birthPlace).toBeUndefined();
    expect(result.deathDate).toBeUndefined();
    expect(result.deathPlace).toBeUndefined();
    expect(result.burialCemeteryName).toBeUndefined();
    expect(result.burialCemeteryLocation).toBeUndefined();
    expect(result.bio).toBeUndefined();
    expect(result.familyLinks).toEqual([]);
  });

  it('extracts name from h1 fallback when bio-name is absent', () => {
    const html = `
      <html>
        <body>
          <h1>Fallback Name</h1>
          <span id="birthDateLabel">1900</span>
        </body>
      </html>
    `;

    const result = parseMemorialPage(html);

    expect(result.name).toBe('Fallback Name');
    expect(result.birthDate).toBe('1900');
  });

  it('handles family links without href', () => {
    const html = `
      <html>
        <body>
          <h1 id="bio-name">Test Person</h1>
          <ul id="familyLinks">
            <li>
              <a>Some Relative</a>
              <span class="relationship">Parent</span>
            </li>
          </ul>
        </body>
      </html>
    `;

    const result = parseMemorialPage(html);

    expect(result.familyLinks).toHaveLength(1);
    expect(result.familyLinks[0]).toEqual({
      name: 'Some Relative',
      memorialId: undefined,
      relationship: 'Parent',
    });
  });
});
