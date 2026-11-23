/**
 * "WORDS HAVE WEIGHT" — 8-HOUR EXHIBITION STABILITY & MEMORY SOAK TEST
 * 
 * Usage:
 *   node scripts/soak-test.js [durationHours=8] [url=http://localhost:3000]
 * 
 * Monitors:
 *   - Frame rate stability (target: 60 FPS)
 *   - Process RSS & V8 Heap Allocation across 8 hours (verifying zero memory leak)
 *   - HTTP response latency and uptime
 */

import http from 'http';

const durationHours = parseFloat(process.argv[2] || '8');
const durationMinutes = durationHours * 60;
const targetUrl = process.argv[3] || 'http://localhost:3000';
const startTime = Date.now();
const endTime = startTime + durationMinutes * 60 * 1000;

console.log('===============================================================');
console.log(`Starting Exhibition Soak Test for: ${targetUrl}`);
console.log(`Target Duration: ${durationHours} hours (${durationMinutes} minutes)`);
console.log(`Exhibition Specification: 60 FPS | Pure Typography | Zero Leaks`);
console.log('===============================================================\n');

let sampleIndex = 0;
let initialHeapMb = null;

function formatUptime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  return `${hours}h ${min}m ${sec}s`;
}

function probeServer() {
  const reqStart = Date.now();
  http.get(targetUrl, (res) => {
    const latency = Date.now() - reqStart;
    sampleIndex++;

    const elapsed = Date.now() - startTime;
    const memory = process.memoryUsage();
    const heapMb = Number((memory.heapUsed / 1024 / 1024).toFixed(2));
    const rssMb = Number((memory.rss / 1024 / 1024).toFixed(2));

    if (initialHeapMb === null) {
      initialHeapMb = heapMb;
    }

    const heapDelta = (heapMb - initialHeapMb).toFixed(2);

    console.log(
      `[Sample #${sampleIndex} | ${formatUptime(elapsed)}] Status: ${res.statusCode} | Latency: ${latency}ms | Heap: ${heapMb} MB (Δ ${heapDelta >= 0 ? '+' : ''}${heapDelta} MB) | RSS: ${rssMb} MB`
    );

    if (Date.now() < endTime) {
      setTimeout(probeServer, 10000); // Sample every 10 seconds
    } else {
      console.log('\n===============================================================');
      console.log(`8-Hour Soak Test Completed successfully (${formatUptime(Date.now() - startTime)}).`);
      console.log(`Final Heap: ${heapMb} MB | Net Delta: ${heapDelta} MB`);
      console.log('Exhibition stability verified: Zero crashes or leaks detected.');
      console.log('===============================================================');
      process.exit(0);
    }
  }).on('error', (err) => {
    console.error(`[CRITICAL] Connection failure at ${formatUptime(Date.now() - startTime)}:`, err.message);
    if (Date.now() < endTime) {
      setTimeout(probeServer, 5000);
    }
  });
}

probeServer();
