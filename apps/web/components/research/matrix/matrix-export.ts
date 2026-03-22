import type { MatrixData } from '@/lib/research/matrix-helpers';

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatFactType(factType: string): string {
  return factType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function exportMatrixAsCsv(
  matrix: MatrixData,
  personName: string,
): void {
  const headers = [
    'Fact Type',
    ...matrix.sources.map((s) => s.title),
    'Conclusion',
  ];

  const rows = matrix.factTypes.map((ft) => {
    const cells = matrix.sources.map((s) => {
      const cell = matrix.cells[ft]?.[s.id];
      return cell ? cell.value : '';
    });
    return [
      formatFactType(ft),
      ...cells,
      matrix.conclusions[ft] ?? '',
    ];
  });

  const csvContent = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().split('T')[0];
  const filename = `${personName.replace(/\s+/g, '-')}-evidence-matrix-${date}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// PDF Export
// ---------------------------------------------------------------------------

export async function exportMatrixAsPdf(
  matrix: MatrixData,
  personName: string,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape' });

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${personName} — Evidence Matrix`, 14, 20);

  // Date
  const date = new Date().toISOString().split('T')[0];
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated ${date}`, 14, 28);
  doc.setTextColor(0, 0, 0);

  // Table header
  const headers = [
    'Fact Type',
    ...matrix.sources.map((s) => s.title),
    'Conclusion',
  ];

  // Table body
  const body = matrix.factTypes.map((ft) => {
    const cells = matrix.sources.map((s) => {
      const cell = matrix.cells[ft]?.[s.id];
      return cell ? cell.value : '';
    });
    return [formatFactType(ft), ...cells, matrix.conclusions[ft] ?? ''];
  });

  // Conflict row indices for highlighting
  const conflictRowIndices = new Set(
    matrix.factTypes
      .map((ft, i) => (matrix.conflicts[ft] ? i : -1))
      .filter((i) => i !== -1),
  );

  const conclusionColIndex = headers.length - 1;

  autoTable(doc, {
    startY: 34,
    head: [headers],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [63, 63, 70], // zinc-700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    didParseCell(data) {
      // Highlight conflict rows with light red background
      if (data.section === 'body' && conflictRowIndices.has(data.row.index)) {
        data.cell.styles.fillColor = [254, 226, 226]; // red-100
      }

      // Conclusion column with light indigo background
      if (
        data.section === 'body' &&
        data.column.index === conclusionColIndex &&
        !conflictRowIndices.has(data.row.index)
      ) {
        data.cell.styles.fillColor = [224, 231, 255]; // indigo-100
      }
    },
  });

  const filename = `${personName.replace(/\s+/g, '-')}-evidence-matrix-${date}.pdf`;
  doc.save(filename);
}
