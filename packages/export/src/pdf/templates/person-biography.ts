export interface PersonBioPdfData {
  name: string;
  dates: string;
  biography: string;
  events: { date: string; type: string; place: string }[];
  sources: { title: string; citation: string }[];
}

export function renderPersonBiographyHtml(data: PersonBioPdfData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 1in; size: letter; }
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 700px; margin: 0 auto; line-height: 1.7; color: #222; }
    h1 { font-size: 28px; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 4px; }
    .dates { color: #666; font-style: italic; font-size: 16px; margin-bottom: 24px; }
    .biography { margin: 24px 0; font-size: 14px; }
    .biography p { margin: 12px 0; text-indent: 2em; }
    h2 { font-size: 18px; margin-top: 32px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .events { margin-top: 16px; }
    .event { margin: 6px 0; font-size: 13px; }
    .event-date { font-weight: bold; }
    .sources { margin-top: 24px; font-size: 12px; color: #555; }
    .source { margin: 4px 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(data.name)}</h1>
  <p class="dates">${escapeHtml(data.dates)}</p>
  <div class="biography">${formatBiography(data.biography)}</div>
  ${data.events.length > 0 ? `
  <h2>Timeline</h2>
  <div class="events">
    ${data.events.map(e => `<div class="event"><span class="event-date">${escapeHtml(e.date)}</span> — ${escapeHtml(e.type)}${e.place ? ` in ${escapeHtml(e.place)}` : ''}</div>`).join('\n    ')}
  </div>` : ''}
  ${data.sources.length > 0 ? `
  <h2>Sources</h2>
  <div class="sources">
    ${data.sources.map(s => `<div class="source">${escapeHtml(s.title)}${s.citation ? `: ${escapeHtml(s.citation)}` : ''}</div>`).join('\n    ')}
  </div>` : ''}
</body>
</html>`;
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
    .join('\n    ');
}
