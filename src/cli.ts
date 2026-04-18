#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { seed } from './cli/seed.js';
import { start } from './cli/start.js';
import { stop } from './cli/stop.js';
import { status } from './cli/status.js';
import { fire } from './cli/fire.js';
import { stats } from './cli/stats.js';
import { exportData } from './cli/export.js';

const program = new Command();

program
  .name('ghost-profile')
  .description('Google Ad Profile polluter — fires randomized searches through your signed-in Chrome profile')
  .version('0.1.0');

program
  .command('seed')
  .description('Load categories and queries into MongoDB')
  .action(seed);

program
  .command('start')
  .description('Start a pollution session — fires queries in batches on a recurring interval')
  .option('--interval <minutes>', 'Minutes between batches', '10')
  .option('--batch <count>', 'Queries per batch', '5')
  .option('--categories <list>', 'Comma-separated category names (default: all)')
  .action(start);

program
  .command('stop')
  .description('Stop the most recently started running session')
  .action(stop);

program
  .command('status')
  .description('Show active and recent sessions')
  .action(status);

program
  .command('fire')
  .description('Fire queries immediately without a recurring schedule')
  .requiredOption('--count <n>', 'Number of queries to fire')
  .option('--categories <list>', 'Comma-separated category names (default: all)')
  .action(fire);

program
  .command('stats')
  .description('Print a summary table of queries fired')
  .option('--since <period>', 'Limit to period, e.g. "7d" for last 7 days')
  .action(stats);

program
  .command('export')
  .description('Export query log as CSV or JSON')
  .requiredOption('--format <csv|json>', 'Output format: csv or json')
  .option('--out <file>', 'Output file path (default: stdout)')
  .action(exportData);

program.parseAsync(process.argv).catch(err => {
  console.error('CLI error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
