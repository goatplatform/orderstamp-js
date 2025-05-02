# Orderstamp

A lightweight, efficient TypeScript utility for maintaining large ordered lists
in databases with minimal write operations. Originally developed for
[GoatDB](https://github.com/goatplatform/goatdb) - the high-performance
distributed database - this algorithm is now available as a standalone package
to help developers solve the common challenge of list ordering in database
applications.

## The Problem

When working with ordered lists in databases, you typically face two suboptimal
approaches:

1. **Store the entire list as a single row**: Simple but doesn't scale for large
   lists
2. **Use integer order columns**: Requires updating many rows for a single
   insertion (O(n) writes)

## The Solution

Orderstamp provides a string-based ordering solution that:

- Performs insertions, deletions, and moves with O(1) writes
- Requires only a standard database index for fast, ordered queries
- Never needs to reindex or update other records when changing one item's
  position
- Works with any database that supports string sorting (including
  [GoatDB](https://github.com/goatplatform/goatdb) or your favourite SQL/NoSQL
  database)

## How It Works

Orderstamp is built on the mathematical principle of continuity: between any two
points, you can always find another point.

For example:

- Between "AA" and "AB", you can have "AAM"
- Between "AAM" and "AAZ", you can have "AAP"
- And so on...

This allows you to insert, delete, or reorder items by simply assigning new
order stamps to individual items, requiring only a single write operation per
change.

## Installation

**npm**:

```bash
npm jsr add @goatdb/orderstamp
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
pnpm dlx jsr add @goatdb/orderstamp
```

**yarn**:

```bash
yarn dlx jsr add @goatdb/orderstamp
```

## API Reference

### `start(): string`

Returns a monotonically decreasing order stamp at the start of the list which
can be used to insert items at the beginning. This function uses the negative of
the current timestamp to ensure that new insertions at the start of the list
will be ordered before existing items.

### `end(): string`

Returns a monotonically increasing order stamp at the end of the list which can
be used to append items at the end. This function uses the current timestamp to
ensure that new insertions at the end of the list naturally increase their
position over time.

### `from(value: number, key?: string, collisionProbability: number = 64): string`

Creates an order stamp from a numeric value and an optional unique key. This
function encodes a numeric value into a string representation that preserves the
ordering of the original numbers.

- `value`: The numeric value to encode in the order stamp
- `key`: Optional unique identifier to append to the encoded value. If not
  provided, a random suffix will be generated automatically.
- `collisionProbability`: The desired collision probability as a power of 2. For
  example, 64 means a probability of 2^-64. Defaults to 64 for practical
  collision resistance in database operations.

### `between(prev: string, next: string, collisionProbability: number = 64): string`

Generates a new stamp lexicographically between two existing stamps. The
function ensures the returned value will sort lexicographically between the two
provided stamps, regardless of their original order.

- `prev`: The first order stamp
- `next`: The second order stamp
- `collisionProbability`: The desired collision probability as a power of 2. For
  example, 64 means a probability of 2^-64. Defaults to 64 for practical
  collision resistance in database operations.

Throws an error if `prev` and `next` are identical (impossible to generate
between identical values).

### Constants

- `CHAR_CODE_MIN = 33`: The minimum character code used in order stamps (ASCII
  '!')
- `CHAR_CODE_MAX = 126`: The maximum character code used in order stamps (ASCII
  '~')

## String Growth Management

One of the key advantages of Orderstamp is its ability to manage string growth
effectively. When repeatedly inserting between two existing stamps, the
generated stamps can grow in length. However, this growth is naturally limited
by the use of `start()` and `end()` functions.

Since `start()` and `end()` generate stamps based on the current timestamp
rather than by splitting the space between existing stamps, they create
fixed-length entries that "reset" the potential growth. In practice, this means:

1. If you occasionally append items using `end()` or prepend items using
   `start()`, you introduce new fixed-length reference points in your ordered
   list.

2. Subsequent `between()` operations will be able to use these timestamp-based
   stamps as boundaries, preventing unbounded growth of stamp lengths.

3. Even in systems with frequent insertions between existing items, the overall
   stamp length remains manageable as long as new items are occasionally added
   at the beginning or end of the list.

This approach ensures that Orderstamp remains efficient for long-running
applications with many insertions, without requiring periodic rebalancing or
reorganization of the entire ordered collection.

## Stamp Length vs Collision Probability

The following table shows how the collision probability affects the length of
generated order stamps:

| Collision Probability | Stamp Length | Description                             |
| --------------------- | ------------ | --------------------------------------- |
| 2^-32                 | 20 chars     | Higher collision chance, shorter stamps |
| 2^-48                 | 26 chars     | Moderate collision chance               |
| 2^-64                 | 28 chars     | Default setting - good balance          |
| 2^-80                 | 30 chars     | Lower collision chance                  |
| 2^-96                 | 32 chars     | Very low collision chance               |
| 2^-112                | 34 chars     | Extremely low collision chance          |
| 2^-128                | 36 chars     | Practically impossible collision chance |

The default collision probability of 2^-64 provides a good balance between stamp
length (28 characters) and collision resistance. You can adjust this value to
trade off between stamp length and collision probability based on your specific
needs.

## Performance Benchmarks

The following benchmarks were run on a standard development machine using Deno,
with 1000 iterations per test.

### Core Operations Performance

| Operation                  | Average Time | Description                                |
| -------------------------- | ------------ | ------------------------------------------ |
| `start()`                  | 998.96µs     | Generating stamps at the start of the list |
| `end()`                    | 999.82µs     | Generating stamps at the end of the list   |
| `from()`                   | 4.30µs       | Creating stamps from numeric values        |
| `between()` (close values) | 6.72µs       | Inserting between adjacent stamps          |
| `between()` (far values)   | 4.74µs       | Inserting between distant stamps           |

### Stamp Length Analysis

At the default collision probability (2^-64):

- Basic stamps: 38 characters
- Realistic sequential insertions:
  - Average: 45.57 characters
  - Median (p50): 43 characters
  - p90: 77 characters
  - p95: 89 characters
  - p99: 103 characters
  - Maximum: 114 characters
- Parallel insertions: 37-46 characters

### Performance Notes

1. The `start()` and `end()` operations are slower because they rely on the
   local system clock. In JavaScript environments, clock changes are
   deliberately throttled for security reasons. In a backend environment, you
   could use a synchronized global clock which would both provide total ordering
   and better performance.

2. The `between()` operation is consistently fast regardless of the distance
   between stamps, making it ideal for frequent insertions.

3. In real-world usage patterns (with occasional use of `start()` and `end()`):
   - 90% of stamps are under 77 characters
   - 95% of stamps are under 89 characters
   - 99% of stamps are under 103 characters
   - The median stamp length is 43 characters

4. The maximum observed length of 114 characters in realistic usage is much more
   reasonable than the theoretical maximum, demonstrating that regular use of
   `start()` and `end()` operations effectively manages stamp length growth.

5. Parallel insertions maintain very consistent lengths between 37-46
   characters, making them ideal for high-concurrency scenarios.

### Collision Probability Impact

| Collision Probability | Stamp Length | Average Time | Description                             |
| --------------------- | ------------ | ------------ | --------------------------------------- |
| 2^-32                 | 22 chars     | 1.22µs       | Higher collision chance, shorter stamps |
| 2^-48                 | 24 chars     | 1.05µs       | Moderate collision chance               |
| 2^-64                 | 27 chars     | 1.00µs       | Default setting - good balance          |
| 2^-80                 | 29 chars     | 1.54µs       | Lower collision chance                  |
| 2^-96                 | 32 chars     | 2.01µs       | Very low collision chance               |
| 2^-112                | 34 chars     | 1.44µs       | Extremely low collision chance          |
| 2^-128                | 37 chars     | 2.92µs       | Practically impossible collision chance |

The default collision probability of 2^-64 provides a good balance between stamp
length (27 characters) and collision resistance. You can adjust this value to
trade off between stamp length and collision probability based on your specific
needs.

## Running Tests and Benchmarks

### Tests

To run the test suite:

```bash
deno test
```

This will execute all tests in the `orderstamp.test.ts` file.

### Benchmarks

To run the benchmarks:

```bash
deno run benchmarks.ts
```

This will execute the performance benchmarks defined in `benchmarks.ts`.

## Dependencies

Orderstamp has a single dependency:

- [ELEN](https://www.npmjs.com/package/elen) - Efficient Lexicographical
  Encoding of Numbers

## License

MIT
