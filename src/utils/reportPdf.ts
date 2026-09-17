import type { ParsedDataset } from '../services/fileParser';

interface ReportOptions {
  stationName: string;
  timeRange: string;
  generatedAt?: Date;
}

interface ReportLine {
  text: string;
  size?: number;
  bold?: boolean;
  color?: [number, number, number];
  gapBefore?: number;
  gapAfter?: number;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT = 48;
const TOP = 790;
const BOTTOM = 52;

function ascii(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^\x20-\x7E]/g, '?');
}

function escapePdfText(value: string): string {
  return ascii(value).replace(/([\\()])/g, '\\$1');
}

function wrapText(value: string, maxCharacters: number): string[] {
  const words = ascii(value).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }
    if (`${current} ${word}`.length <= maxCharacters) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? ascii(value) : date.toLocaleDateString('en-IN');
}

function reportLines(dataset: ParsedDataset, options: ReportOptions): ReportLine[] {
  const generatedAt = options.generatedAt ?? new Date();
  const totalEntities = dataset.persons.length + dataset.phones.length + dataset.vehicles.length + dataset.accounts.length;
  const lines: ReportLine[] = [
    { text: 'INVESTIGATION INTELLIGENCE REPORT', size: 19, bold: true, color: [8, 55, 82], gapAfter: 5 },
    { text: `NexusNet Intelligence | ${options.stationName}`, size: 11, bold: true, color: [18, 117, 111] },
    { text: `Generated: ${generatedAt.toLocaleString('en-IN')} | Dashboard scope: ${options.timeRange}`, size: 9, color: [80, 98, 112], gapAfter: 14 },
    { text: 'EXECUTIVE SUMMARY', size: 13, bold: true, color: [8, 55, 82], gapBefore: 4, gapAfter: 4 },
    { text: `Active cases: ${dataset.cases.length}    Tracked entities: ${totalEntities}    Identified networks: ${dataset.stats.networks}    Alerts: ${dataset.stats.alerts}`, size: 10, gapAfter: 5 },
    { text: `Graph coverage: ${dataset.graphData.nodes.length} nodes and ${dataset.graphData.edges.length} evidence-linked relationships.`, size: 10, gapAfter: 11 },
    { text: 'CASE OVERVIEW', size: 13, bold: true, color: [8, 55, 82], gapAfter: 5 },
  ];

  dataset.cases.forEach((item, index) => {
    lines.push({
      text: `${index + 1}. ${item.case_id} | ${item.fir_number} | ${item.crime_type} | ${item.status}`,
      size: 10,
      bold: true,
      color: [21, 48, 66],
      gapBefore: index ? 5 : 0,
    });
    lines.push({ text: `${item.district}, ${item.state} | Filed: ${formatDate(item.date_filed)}`, size: 9, color: [80, 98, 112] });
    lines.push({ text: item.summary || 'No case summary supplied.', size: 9, gapAfter: 3 });
  });

  lines.push({ text: 'KEY PEOPLE AND IDENTITIES', size: 13, bold: true, color: [8, 55, 82], gapBefore: 12, gapAfter: 5 });
  if (!dataset.persons.length) lines.push({ text: 'No people were extracted from the current investigation records.', size: 9 });
  dataset.persons.forEach((person, index) => lines.push({
    text: `${index + 1}. ${person.name} | ${person.role} | Cases: ${person.caseIds.join(', ') || 'Unlinked'}`,
    size: 9,
    gapAfter: 2,
  }));

  lines.push({ text: 'IDENTIFIERS', size: 13, bold: true, color: [8, 55, 82], gapBefore: 12, gapAfter: 5 });
  lines.push({ text: `Phones (${dataset.phones.length}): ${dataset.phones.map((item) => item.number).join(', ') || 'None extracted'}`, size: 9 });
  lines.push({ text: `Vehicles (${dataset.vehicles.length}): ${dataset.vehicles.map((item) => item.plate_number).join(', ') || 'None extracted'}`, size: 9 });
  lines.push({ text: `Accounts (${dataset.accounts.length}): ${dataset.accounts.map((item) => item.account_id).join(', ') || 'None extracted'}`, size: 9 });

  lines.push({ text: 'PRIORITY ALERTS', size: 13, bold: true, color: [8, 55, 82], gapBefore: 12, gapAfter: 5 });
  if (!dataset.alerts.length) lines.push({ text: 'No analytical alerts are present in the current dataset.', size: 9 });
  dataset.alerts.forEach((alert, index) => {
    lines.push({ text: `${index + 1}. [${alert.priority}] ${alert.title}`, size: 9, bold: true });
    lines.push({ text: alert.description, size: 9, gapAfter: 3 });
  });

  lines.push({ text: 'EVIDENCE AND RELATIONSHIPS', size: 13, bold: true, color: [8, 55, 82], gapBefore: 12, gapAfter: 5 });
  if (!dataset.evidence.length) lines.push({ text: 'No evidence records are linked to the current investigation.', size: 9 });
  dataset.evidence.slice(0, 30).forEach((item, index) => lines.push({
    text: `${index + 1}. ${item.case_id} | ${item.entityA} ${item.relationship} ${item.entityB} | ${item.evidenceType}`,
    size: 9,
    gapAfter: 2,
  }));
  if (dataset.evidence.length > 30) lines.push({ text: `${dataset.evidence.length - 30} additional evidence records omitted from this summary.`, size: 9, color: [80, 98, 112] });

  lines.push({ text: 'TIMELINE', size: 13, bold: true, color: [8, 55, 82], gapBefore: 12, gapAfter: 5 });
  if (!dataset.timelineEvents.length) lines.push({ text: 'No timeline events were extracted.', size: 9 });
  dataset.timelineEvents.slice(0, 25).forEach((event, index) => lines.push({
    text: `${index + 1}. ${formatDate(event.timestamp)} | ${event.case_id} | ${event.event_type} | ${event.location || 'Location not specified'}`,
    size: 9,
    gapAfter: 2,
  }));

  lines.push({ text: 'ANALYTICAL NOTICE', size: 12, bold: true, color: [136, 87, 12], gapBefore: 14, gapAfter: 4 });
  lines.push({
    text: 'This report summarizes uploaded investigation records and analytical links. Inferences require investigator verification and do not establish guilt. Source records and provenance must be reviewed before operational use.',
    size: 9,
  });
  return lines;
}

function paginate(lines: ReportLine[]): ReportLine[][] {
  const pages: ReportLine[][] = [[]];
  let y = TOP;
  lines.forEach((line) => {
    const size = line.size ?? 9;
    const wrapped = wrapText(line.text, Math.max(34, Math.floor(92 * (9 / size))));
    const height = wrapped.length * (size + 3) + (line.gapBefore ?? 0) + (line.gapAfter ?? 0);
    if (y - height < BOTTOM) {
      pages.push([]);
      y = TOP;
    }
    pages[pages.length - 1].push(line);
    y -= height;
  });
  return pages;
}

function pageStream(lines: ReportLine[], pageNumber: number, pageCount: number): string {
  const commands: string[] = [
    '0.965 0.98 0.985 rg 0 0 595 842 re f',
    '0.035 0.216 0.322 rg 0 812 595 30 re f',
    `BT /F2 9 Tf 1 1 1 rg ${LEFT} 824 Td (NEXUSNET INTELLIGENCE) Tj ET`,
  ];
  let y = TOP;
  lines.forEach((line) => {
    const size = line.size ?? 9;
    const color = line.color ?? [35, 52, 64];
    y -= line.gapBefore ?? 0;
    const wrapped = wrapText(line.text, Math.max(34, Math.floor(92 * (9 / size))));
    wrapped.forEach((text) => {
      commands.push(`BT /${line.bold ? 'F2' : 'F1'} ${size} Tf ${color.map((value) => (value / 255).toFixed(3)).join(' ')} rg ${LEFT} ${y} Td (${escapePdfText(text)}) Tj ET`);
      y -= size + 3;
    });
    y -= line.gapAfter ?? 0;
  });
  commands.push(`BT /F1 8 Tf 0.35 0.42 0.47 rg ${LEFT} 28 Td (NexusNet - Evidence-grounded investigative report) Tj ET`);
  commands.push(`BT /F1 8 Tf 0.35 0.42 0.47 rg 500 28 Td (Page ${pageNumber} of ${pageCount}) Tj ET`);
  return commands.join('\n');
}

export function buildInvestigationReportPdf(dataset: ParsedDataset, options: ReportOptions): Uint8Array {
  const pages = paginate(reportLines(dataset, options));
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  const pageIds: number[] = [];
  pages.forEach((page, index) => {
    const pageId = 5 + index * 2;
    const streamId = pageId + 1;
    pageIds.push(pageId);
    const stream = pageStream(page, index + 1, pages.length);
    const streamLength = new TextEncoder().encode(stream).length;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId] = `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  const encoder = new TextEncoder();
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = encoder.encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return encoder.encode(pdf);
}

export function downloadInvestigationReport(dataset: ParsedDataset, options: ReportOptions): void {
  const bytes = buildInvestigationReportPdf(dataset, options);
  const pdfBuffer = new Uint8Array(bytes.byteLength);
  pdfBuffer.set(bytes);
  const blob = new Blob([pdfBuffer.buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const date = (options.generatedAt ?? new Date()).toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `NexusNet-Investigation-Report-${date}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
