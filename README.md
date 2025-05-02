# Orderstamp

Orderstamp is a TypeScript utility for maintaining large ordered lists in
databases with minimal write operations. It provides efficient, string-based
ordering suitable for any database supporting string sorting.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [API Reference](#api-reference)
- [Usage Guidelines](#usage-guidelines)
- [String Growth and Bulk Allocation](#string-growth-and-bulk-allocation)
- [Performance](#performance)
- [Testing and Benchmarks](#testing-and-benchmarks)
- [Dependencies](#dependencies)
- [License](#license)

## Overview

Traditional approaches to ordered lists in databases are inefficient:

- Storing the entire list as a single row does not scale.
- Using integer order columns requires O(n) writes for insertions.

Orderstamp addresses these issues by:

- Enabling O(1) writes for insertions, deletions, and moves.
- Requiring only a standard string index for ordered queries.
- Avoiding reindexing or mass updates when changing item positions.

Orderstamp is database-agnostic and works with any system that supports string
sorting.

## Installation

**npm**:

```bash
npx jsr add @goatdb/orderstamp
```

**Deno**:

```bash
deno add jsr:@goatdb/orderstamp
```

**Bun**:

```bash
bunx jsr add @goatdb/orderstamp
```

**pnpm**:

```bash
pnpm i jsr:@goatdb/orderstamp
```

or (for pnpm 10.8 or older):

```bash
pnpm dlx jsr add @goatdb/orderstamp
```

**yarn**:

```bash
yarn add jsr:@goatdb/orderstamp
```

or (for Yarn 4.8 or older):

```bash
yarn dlx jsr add @goatdb/orderstamp
```

## API Reference

| Function    | Purpose                           | Use Case                      |
| ----------- | --------------------------------- | ----------------------------- |
| `start()`   | Stamp for the start of the list   | Prepend item                  |
| `end()`     | Stamp for the end of the list     | Append item                   |
| `from()`    | Encode a number as an order stamp | Numeric ordering, custom keys |
| `between()` | Stamp between two existing stamps | Insert between two items      |

### `start()`

Returns a monotonically decreasing order stamp for the start of the list. Uses
the negative of the current timestamp to ensure new items are ordered before
existing ones.

### `end()`

Returns a monotonically increasing order stamp for the end of the list. Uses the
current timestamp to ensure new items are ordered after existing ones.

### `from(value: number, key?: string, collisionProbability: number = 64): string`

Encodes a numeric value (and optional key) as an order stamp. Maintains numeric
order in string form.

- `value`: Number to encode.
- `key`: Optional unique identifier. If omitted, a random suffix is generated.
- `collisionProbability`: Power-of-2 collision probability (default: 64, i.e.,
  2^-64).

### `between(prev: string, next: string, count: number = 1, index: number = 0, collisionProbability: number = 64): string`

Generates a stamp lexicographically between two existing stamps. Supports single
and bulk insertions.

- `prev`: First order stamp.
- `next`: Second order stamp.
- `count`: Number of stamps to generate (for bulk allocation, default: 1).
- `index`: Zero-based index for bulk allocation (default: 0).
- `collisionProbability`: Power-of-2 collision probability (default: 64).

Throws if `prev` and `next` are identical, or if `count`/`index` are out of
range.

#### Usage

- Single insertion: `between(prev, next)`
- Bulk allocation: `between(prev, next, N, i)` for `i` in `0..N-1`

## String Growth and Bulk Allocation

Repeated insertions between two stamps can increase stamp length. To manage
this:

- Use `start()` and `end()` periodically to reset boundaries and keep stamp
  lengths short.
- For many insertions between the same two points, use bulk allocation:

```ts
// Inefficient (causes stamp growth):
let s = prev;
for (let i = 0; i < N; i++) {
  s = between(s, next);
}

// Efficient (prevents growth):
for (let i = 0; i < N; i++) {
  const stamp = between(prev, next, N, i);
}
```

## Performance

Benchmarks (Deno, 1000 iterations):

| Operation                  | Avg Time | Description                    |
| -------------------------- | -------- | ------------------------------ |
| `start()`                  | 998.30µs | Generate start stamp           |
| `end()`                    | 1.08ms   | Generate end stamp             |
| `from()`                   | 18.28µs  | Encode number as stamp         |
| `between()` (close values) | 38.44µs  | Insert between adjacent stamps |

### Stamp Length (Best Practices)

| Metric       | Bulk (100) | Seq+Reset (1000) | Bulk+Reset (10×50) |
| ------------ | :--------: | :--------------: | :----------------: |
| Avg length   |     42     |      21.72       |         11         |
| Median (p50) |     42     |        20        |         11         |
| p90          |     42     |        37        |         11         |
| p95          |     42     |        42        |         11         |
| p99          |     42     |        49        |         11         |
| Min          |     42     |        11        |         11         |
| Max          |     42     |        51        |         11         |

- Bulk allocation keeps stamp lengths fixed.
- Periodic use of `start()`/`end()` prevents unbounded growth.
- `between()` is fast and suitable for frequent insertions.

See `benchmarks.ts` for details.

## Testing and Benchmarks

### Tests

Run all tests:

```bash
deno test
```

### Benchmarks

Run benchmarks:

```bash
deno run benchmarks.ts
```

## Dependencies

- [ELEN](https://www.npmjs.com/package/elen): Efficient Lexicographical Encoding
  of Numbers

## License

MIT
