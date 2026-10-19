// Quotes protect CSV structure; a leading apostrophe prevents spreadsheet formula execution.
export function serializeCsv(rows: string[][]) {
  return "\uFEFF" + rows.map(row=>row.map(raw=> {
    const cell = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${cell.replaceAll('"','""')}"`;
  }).join(",")).join("\r\n");
}
