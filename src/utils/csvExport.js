/**
 * Convert array of objects to CSV string.
 */
export function arrayToCSV(headers, rows) {
  const headerLine = headers.map(h => `"${h.label}"`).join(',');
  const dataLines = rows.map(row =>
    headers.map(h => {
      const val = String(row[h.key] ?? '').replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Trigger browser download of a CSV file.
 */
export function downloadCSV(filename, csvString) {
  // Add BOM for Excel compatibility with UTF-8
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
