// Exportação e importação CSV no client (FR-C4 e relatórios). Separador ';'
// e BOM UTF-8 para abrir corretamente no Excel pt-BR.

function escapeCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(";"));
  return "﻿" + lines.join("\r\n");
}

/** Parse de CSV com aspas e separador autodetectado (';' do Excel pt-BR ou ','). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstBreak = src.search(/\r|\n/);
  const firstLine = firstBreak === -1 ? src : src.slice(0, firstBreak);
  const delim =
    (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const endCell = () => { row.push(cell.trim()); cell = ""; };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) endCell();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRow();
    } else cell += ch;
  }
  endRow();
  return rows;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
