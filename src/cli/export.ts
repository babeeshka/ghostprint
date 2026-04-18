import fs from 'fs';
import path from 'path';
import { connectDb, disconnectDb } from '../db.js';
import { Query } from '../models/Query.js';
import type { IQuery } from '../models/Query.js';

interface ExportOptions {
  format: 'csv' | 'json';
  out?: string;
}

export async function exportData(opts: ExportOptions): Promise<void> {
  if (opts.format !== 'csv' && opts.format !== 'json') {
    console.error('--format must be "csv" or "json"');
    process.exit(1);
  }

  await connectDb();

  const queries = await Query.find().sort({ firedAt: -1 }).lean();

  let output: string;
  if (opts.format === 'json') {
    output = JSON.stringify(queries, null, 2);
  } else {
    output = toCSV(queries as unknown as IQuery[]);
  }

  if (opts.out) {
    const outPath = path.resolve(opts.out);
    fs.writeFileSync(outPath, output, 'utf8');
    console.log(`Exported ${queries.length} queries to ${outPath}`);
  } else {
    process.stdout.write(output);
  }

  await disconnectDb();
}

function toCSV(queries: IQuery[]): string {
  const headers = [
    'sessionId', 'text', 'category', 'firedAt', 'success',
    'loadTimeMs', 'dwellMs', 'pageTitleAfter', 'clickedResultUrl', 'errorMsg',
  ];

  const rows = queries.map(q => [
    q.sessionId.toString(),
    csvEscape(q.text),
    q.category,
    q.firedAt.toISOString(),
    q.success.toString(),
    q.loadTimeMs?.toString() ?? '',
    q.dwellMs.toString(),
    csvEscape(q.pageTitleAfter ?? ''),
    q.clickedResultUrl ?? '',
    csvEscape(q.errorMsg ?? ''),
  ].join(','));

  return [headers.join(','), ...rows].join('\n') + '\n';
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
