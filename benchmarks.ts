import { between, end, from, start } from "./orderstamp.ts";

function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function runBenchmark(
  name: string,
  fn: () => void,
  iterations: number = 1000,
): void {
  const startTime = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const endTime = performance.now();
  const avgTime = (endTime - startTime) / iterations;

  console.log(`\n${name}:`);
  console.log(`  Iterations: ${iterations}`);
  console.log(`  Average time: ${formatTime(avgTime)}`);
}

function formatDistribution(dist: Record<number, number>): string {
  const entries = Object.entries(dist).map(([len, count]) =>
    `${len}: ${count}`
  );
  return entries.join(", ");
}

function analyzeStamps(stamps: string[], name: string): void {
  const lengths = stamps.map((s) => s.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const maxLength = Math.max(...lengths);
  const minLength = Math.min(...lengths);

  // Calculate percentiles
  const sortedLengths = [...lengths].sort((a, b) => a - b);
  const p50 = sortedLengths[Math.floor(sortedLengths.length * 0.5)];
  const p90 = sortedLengths[Math.floor(sortedLengths.length * 0.9)];
  const p95 = sortedLengths[Math.floor(sortedLengths.length * 0.95)];
  const p99 = sortedLengths[Math.floor(sortedLengths.length * 0.99)];

  const distribution = lengths.reduce((acc, len) => {
    acc[len] = (acc[len] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  console.log(`\n${name} Analysis:`);
  console.log(`  Average length: ${avgLength.toFixed(2)}`);
  console.log(`  Median length (p50): ${p50}`);
  console.log(`  p90 length: ${p90}`);
  console.log(`  p95 length: ${p95}`);
  console.log(`  p99 length: ${p99}`);
  console.log(`  Min length: ${minLength}`);
  console.log(`  Max length: ${maxLength}`);
  console.log(`  Length distribution: ${formatDistribution(distribution)}`);
}

console.log("=== OrderStamp Best Practice Benchmarks ===\n");

// Core operations (including between for close values)
runBenchmark("start()", () => start());
runBenchmark("end()", () => end());
runBenchmark("from()", () => from(performance.now()));
runBenchmark("between() (close values)", () => {
  const a = from(1);
  const b = from(2);
  between(a, b);
});

// Bulk Allocation (Best Practice)
console.log("\n=== Bulk Allocation (Best Practice) ===");

const BULK_N = 100;
const bulkPrev = from(1000);
const bulkNext = from(2000);

let bulkStamps = [];
for (let i = 0; i < BULK_N; i++) {
  bulkStamps.push(between(bulkPrev, bulkNext, BULK_N, i, 64));
}
analyzeStamps(bulkStamps, `Bulk Allocation between() (${BULK_N} insertions)`);

// Realistic sequential insertions with occasional resets (Best Practice)
console.log("\n=== Realistic Sequential Insertions with Occasional Resets ===");

const realisticStamps = [];
let realisticCurrent = start();
let realisticNext = end();
let realisticInsertions = 0;
const REALISTIC_RESET_THRESHOLD = 100; // Reset boundaries every 100 insertions
const MIXED_OPERATIONS_PROBABILITY = 0.2; // 20% chance of using start/end

for (let i = 0; i < 1000; i++) {
  if (
    realisticInsertions >= REALISTIC_RESET_THRESHOLD ||
    Math.random() < MIXED_OPERATIONS_PROBABILITY
  ) {
    // Occasionally reset boundaries or use start/end to better reflect real-world usage
    if (Math.random() < 0.5) {
      realisticCurrent = start();
    } else {
      realisticNext = end();
    }
    realisticInsertions = 0;
  }

  realisticCurrent = between(realisticCurrent, realisticNext);
  realisticStamps.push(realisticCurrent);
  realisticInsertions++;
}
analyzeStamps(realisticStamps, "Realistic Sequential Insertions");

// Bulk allocations with periodic resets (Combined Best Practice)
console.log("\n=== Bulk Allocations with Periodic Resets ===");

const BULK_BATCHES = 10;
const BULK_BATCH_SIZE = 50;
const bulkPeriodicStamps = [];
for (let batch = 0; batch < BULK_BATCHES; batch++) {
  let prev = start();
  let next = end();
  for (let i = 0; i < BULK_BATCH_SIZE; i++) {
    bulkPeriodicStamps.push(between(prev, next, BULK_BATCH_SIZE, i, 64));
  }
}
analyzeStamps(
  bulkPeriodicStamps,
  `Bulk Allocations with Periodic Resets (${BULK_BATCHES} batches of ${BULK_BATCH_SIZE})`,
);
