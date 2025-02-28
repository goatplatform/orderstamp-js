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

Returns an order stamp at the beginning of the list. This stamp is based on the
negative of the current timestamp, ensuring that repeatedly calling `start()`
will generate stamps that maintain reverse chronological order. This makes it
simple to insert items at the top of a list - just call `start()` each time you
need a new position at the beginning.

### `end(): string`

Returns an order stamp at the end of the list. This stamp is based on the
current timestamp, ensuring that repeatedly calling `end()` will generate stamps
that maintain chronological order. This makes it simple to append items to the
end of a list - just call `end()` each time you need a new position.

### `between(prev: string, next: string): string`

Generates a new stamp lexicographically between two existing stamps.

### `from(value: number, key?: string): string`

Creates an order stamp from a numeric value and an optional unique key.

## Dependencies

Orderstamp has a single dependency:

- [ELEN](https://www.npmjs.com/package/elen) - Efficient Lexicographical
  Encoding of Numbers

## License

MIT
