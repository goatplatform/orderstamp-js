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

  const distribution = lengths.reduce((acc, len) => {
    acc[len] = (acc[len] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  console.log(`\n${name} Analysis:`);
  console.log(`  Average length: ${avgLength.toFixed(2)}`);
  console.log(`  Min length: ${minLength}`);
  console.log(`  Max length: ${maxLength}`);
  console.log(`  Length distribution: ${formatDistribution(distribution)}`);
}

console.log("=== OrderStamp Performance Benchmarks ===\n");

// Basic operations
runBenchmark("start()", () => start());
runBenchmark("end()", () => end());
runBenchmark("from()", () => from(performance.now()));

// Between operations
runBenchmark("between() - close values", () => {
  const a = from(1);
  const b = from(2);
  between(a, b);
});

runBenchmark("between() - far values", () => {
  const a = from(1);
  const b = from(1000000);
  between(a, b);
});

// Stamp length analysis
console.log("\n=== Stamp Length Analysis ===");

// Basic stamp generation
const basicStamps = [];
for (let i = 0; i < 1000; i++) {
  basicStamps.push(from(performance.now()));
}
analyzeStamps(basicStamps, "Basic Generation");

// Sequential insertions
const sequentialStamps = [];
let current = start();
for (let i = 0; i < 1000; i++) {
  const next = end();
  current = between(current, next);
  sequentialStamps.push(current);
}
analyzeStamps(sequentialStamps, "Sequential Insertions");

// Parallel insertions
const parallelStamps = [];
const points = [];
for (let i = 0; i < 10; i++) {
  points.push(end());
}
for (let i = 0; i < points.length - 1; i++) {
  const prev = points[i];
  const next = points[i + 1];
  for (let j = 0; j < 100; j++) {
    parallelStamps.push(between(prev, next));
  }
}
analyzeStamps(parallelStamps, "Parallel Insertions");

// Collision probability impact
console.log("\n=== Collision Probability Impact ===");
const probabilities = [-32, -48, -64, -80, -96, -112, -128];
const prev = from(1);
const next = from(2);

for (const prob of probabilities) {
  const stamps = [];
  const startTime = performance.now();
  for (let i = 0; i < 100; i++) {
    stamps.push(between(prev, next, prob));
  }
  const endTime = performance.now();
  const avgTime = (endTime - startTime) / 100;

  console.log(`\nCollision probability: 2^${prob}`);
  console.log(`  Average time: ${formatTime(avgTime)}`);
  analyzeStamps(stamps, `Probability 2^${prob}`);
}
