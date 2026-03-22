export interface FamilyHistoryPdfData {
  familyName: string;
  compiledBy: string;
  compiledDate: string;
  persons: {
    name: string;
    dates: string;
    biography?: string;
    events: { date: string; type: string; place: string }[];
    generation: number;
  }[];
}

export function renderFamilyHistoryHtml(data: FamilyHistoryPdfData): string {
  const generationGroups = groupByGeneration(data.persons);
  const generationNumbers = Object.keys(generationGroups)
    .map(Number)
    .sort((a, b) => a - b);

  const tocEntries = data.persons
    .map(p => `<li><a href="#person-${slugify(p.name)}">${escapeHtml(p.name)}</a> <span class="toc-dates">${escapeHtml(p.dates)}</span></li>`)
    .join('\n      ');

  const personSections = generationNumbers
    .map(gen => {
      const persons = generationGroups[gen];
      const personHtml = persons
        .map(p => renderPersonSection(p))
        .join('\n    ');
      return `
    <h2 class="generation-heading">Generation ${gen}</h2>
    ${personHtml}`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 1in; size: letter; }
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 700px; margin: 0 auto; line-height: 1.7; color: #222; }
    .cover { text-align: center; padding: 120px 0 80px; page-break-after: always; }
    .cover h1 { font-size: 36px; border: none; margin-bottom: 8px; }
    .cover .subtitle { font-size: 18px; color: #555; font-style: italic; }
    .cover .compiled { margin-top: 60px; font-size: 14px; color: #777; }
    .toc { page-break-after: always; }
    .toc h2 { font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 6px; }
    .toc ul { list-style: none; padding: 0; }
    .toc li { margin: 6px 0; font-size: 14px; }
    .toc a { color: #333; text-decoration: none; }
    .toc a:hover { text-decoration: underline; }
    .toc-dates { color: #888; font-style: italic; font-size: 12px; }
    .generation-heading { font-size: 22px; margin-top: 40px; border-bottom: 2px solid #333; padding-bottom: 6px; page-break-before: always; }
    .person { margin: 32px 0; }
    .person h3 { font-size: 20px; margin-bottom: 4px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .person .dates { color: #666; font-style: italic; font-size: 15px; margin-bottom: 16px; }
    .person .biography { font-size: 14px; }
    .person .biography p { margin: 10px 0; text-indent: 2em; }
    .person .events { margin-top: 12px; }
    .person .event { margin: 4px 0; font-size: 13px; }
    .person .event-date { font-weight: bold; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${escapeHtml(data.familyName)} Family History</h1>
    <p class="subtitle">A compiled genealogical narrative</p>
    <p class="compiled">Compiled by ${escapeHtml(data.compiledBy)}<br>${escapeHtml(data.compiledDate)}</p>
  </div>

  <div class="toc">
    <h2>Table of Contents</h2>
    <ul>
      ${tocEntries}
    </ul>
  </div>

  ${personSections}
</body>
</html>`;
}

function renderPersonSection(person: FamilyHistoryPdfData['persons'][number]): string {
  const biographyHtml = person.biography
    ? `<div class="biography">${formatBiography(person.biography)}</div>`
    : '';

  const eventsHtml = person.events.length > 0
    ? `<div class="events">
        ${person.events.map(e => `<div class="event"><span class="event-date">${escapeHtml(e.date)}</span> — ${escapeHtml(e.type)}${e.place ? ` in ${escapeHtml(e.place)}` : ''}</div>`).join('\n        ')}
      </div>`
    : '';

  return `<div class="person" id="person-${slugify(person.name)}">
      <h3>${escapeHtml(person.name)}</h3>
      <p class="dates">${escapeHtml(person.dates)}</p>
      ${biographyHtml}
      ${eventsHtml}
    </div>`;
}

function groupByGeneration(
  persons: FamilyHistoryPdfData['persons']
): Record<number, FamilyHistoryPdfData['persons']> {
  const groups: Record<number, FamilyHistoryPdfData['persons']> = {};
  for (const person of persons) {
    if (!groups[person.generation]) {
      groups[person.generation] = [];
    }
    groups[person.generation].push(person);
  }
  return groups;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBiography(text: string): string {
  return text
    .split('\n\n')
    .map(p => `<p>${escapeHtml(p.trim())}</p>`)
    .join('\n      ');
}
