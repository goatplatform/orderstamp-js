/**
 * @module orderstamp
 *
 * Provides utilities for creating and managing order stamps, a string-based
 * solution for efficient ordered lists in databases.
 *
 * ## Background
 *
 * When maintaining an ordered list of database records, two common approaches are:
 *
 * 1. Store the entire list as a single row. Each write overwrites the entire
 *    list, ensuring correct order when multiple writers exist. This works well
 *    for short lists but doesn't scale for larger datasets.
 *
 * 2. Store each list item as its own row with an integer order column
 *    representing its position in the list. However, insertions and deletions
 *    require updating all subsequent indexes, resulting in O(N) update costs
 *    (and require support for large transactions).
 *
 * ## Order Stamps Solution
 *
 * Order stamps provide an efficient alternative that performs insertions and
 * deletions in O(1) time, with a trade-off of O(N) reads (where N is only the
 * subset of selected rows, not all ordered rows). They integrate well with
 * standard database indexing, making ordered queries fast and efficient.
 *
 * With order stamps, we assign a string-based order column to each row instead
 * of an integer. Inserting, deleting, or moving an item requires updating only
 * its order column (a single write to a single row). Reading items in order
 * simply requires sorting the rows by this order column.
 *
 * ## Mathematical Foundation: Continuity
 *
 * Order stamps are built on the mathematical principle of continuity - that
 * between any two points, you can always find another point. With numbers,
 * this is intuitive: between 1 and 2, you can have 1.5; between 1 and 1.5,
 * you can have 1.25, and so on.
 *
 * The key insight is that strings can implement this same concept while
 * overcoming a critical limitation of fixed-precision numbers. While numbers
 * eventually run into precision limits
 * (such as with floating point values), strings can extend their length
 * indefinitely:
 *
 * - If you need to insert between "AA" and "AB", you can use, for example, "AAA"
 * - If you need to insert between "AAM" and "AN", you can use, for example, "AC"
 *
 * Strings give us the ability to always find a lexicographically ordered value
 * between any two existing values, no matter how close they appear, by simply
 * extending the length as needed.
 *
 * ## How Order Stamp Generation Works
 *
 * 1. **Start/End Markers**:
 *    - `start()` creates a stamp at the minimum possible value
 *    - `end()` creates a stamp using the current timestamp, ensuring
 *      chronological order
 *
 * 2. **Between Operation**:
 *    - Find the common prefix between two existing stamps
 *    - Generate a character that falls lexicographically between the first
 *        differing characters
 *    - Add a random suffix to ensure uniqueness
 *
 * 3. **Numeric Conversion**:
 *    - Timestamps and indices are encoded using ELEN (Efficient Lexicographical
 *      Encoding of Numbers by Peter Seymour)
 *    - Random suffixes prevent collisions when multiple stamps are created
 *      concurrently
 *
 * Order stamps are specifically designed to preserve their relative ordering
 * when sorted lexicographically, a capability efficiently supported by most
 * databases and programming languages.
 */
import * as ELEN from "npm:elen";

/**
 * The minimum character code used in order stamps.
 *
 * While we could theoretically use the entire Unicode character space,
 * we limit ourselves to ASCII-compatible characters for better compatibility
 * across different systems, databases, and serialization formats.
 */
export const CHAR_CODE_MIN = 1;

/**
 * The maximum character code used in order stamps.
 *
 * We use a value of 254 (exclusive), which reserves character code 254
 * for the right edge of the ordering space. This ensures we have a clear
 * boundary for the maximum possible value while maintaining compatibility
 * with various text encodings and database systems.
 */
export const CHAR_CODE_MAX = 254;

/**
 * The length of the random suffix used in order stamps.
 *
 * When generating order stamps, this constant determines the number of random
 * characters appended to ensure uniqueness and proper ordering even when
 * multiple stamps are created between the same values or at the same timestamp.
 *
 * With 254 possible characters per position and 16 positions, this provides
 * approximately 254^16 (≈ 3.7 × 10^38) possible combinations, making the
 * probability of collision extremely low even in high-volume systems.
 */
const RANDOM_SUFFIX_LEN = 16;

/**
 * Returns a fixed order stamp at the end of the list which can be used to
 * append to the end of the list.
 *
 * This function uses the current timestamp to ensure that new insertions at
 * the end of the list naturally increase their position over time. This
 * approach maintains chronological ordering where newer items appear at the
 * end of the list.
 */
export function end(): string {
  return from(performance.now());
}

/**
 * Returns a fixed order stamp in the start of the list which can be used to
 * insert at the start of the list.
 */
export function start(): string {
  return from(-performance.now());
}

/**
 * Creates an order stamp from a numeric value and an optional unique key.
 *
 * This function encodes a numeric value into a string representation that
 * preserves the ordering of the original numbers. The resulting string can be
 * used in ordered collections where lexicographic string comparison should
 * match numeric ordering.
 *
 * @param value - The numeric value to encode in the order stamp
 * @param key - Optional unique identifier to append to the encoded value.
 *              Provide this if the item already has a random unique ID to use,
 *              otherwise a random suffix will be generated automatically.
 * @returns A string order stamp that preserves ordering
 */
export function from(value: number, key?: string) {
  if (key === undefined) {
    key = "";
    for (let j = 0; j < RANDOM_SUFFIX_LEN; ++j) {
      key += String.fromCharCode(randomInt(CHAR_CODE_MIN, CHAR_CODE_MAX));
    }
  }
  return ELEN.encode(value) + key;
}

/**
 * Given two order stamps, this function generates and returns a value between
 * them. To generate values at the edge of the list use the {@link start} and
 * {@link end} functions.
 *
 * This function ensures the returned value will sort lexicographically between
 * the two provided stamps, regardless of their original order. It adds random
 * characters to minimize collision probability in high-frequency operations.
 *
 * Note: You can pass the values in any order you like.
 *
 * @param prev - The first order stamp
 * @param next - The second order stamp
 * @returns A new order stamp that sorts between the two input stamps
 * @throws Error if prev and next are identical (impossible to generate between
 *         identical values)
 */
export function between(prev: string, next: string): string {
  // Sanity check. If prev and next are equal, there's no way to generate a
  // value between them.
  if (prev === next) {
    throw new Error("prev and next must be different");
  }

  // Make sure values are in the correct order
  if (prev > next) {
    const tmp = next;
    next = prev;
    prev = tmp;
  }

  // prev has length <= next, and shares a common prefix with next
  const prefixLen = commonPrefixLen(prev, next);
  let result = prev.substring(0, prefixLen);

  // First char after shared prefix is guaranteed to be smaller in prev than
  // in next. Note that it may not actually exist (if prev is shorter than next)
  const minChar = prefixLen < prev.length
    ? prev.charCodeAt(prefixLen)
    : prev.charCodeAt(0);
  const maxChar = prefixLen > 0
    ? next.charCodeAt(prefixLen)
    : next.charCodeAt(0);
  // Append a random char between prev[prefixLen] and next[prefixLen]. This
  // will place our result before next but also before prev.
  result += String.fromCharCode(randomInt(minChar, maxChar));

  // Search prev from prefixLen+1 to its end
  for (let i = prefixLen + 1; i < prev.length; ++i) {
    const charCode = prev.charCodeAt(i);
    // If we found a char less than MAX, generate a char greater than that
    // which will place our result *after* next.
    if (charCode < CHAR_CODE_MAX) {
      result += String.fromCharCode(randomInt(charCode + 1, CHAR_CODE_MAX));
      break;
    } else {
      // If we found the MAX char, copy it and try again on the following char.
      result += String.fromCharCode(charCode);
    }
  }

  // At this point we can guarantee that:
  //
  // - Our result comes before next
  //
  // - If prev was long enough and not filled with MAX chars, then our result
  //   also comes after prev
  //
  // In any case, we append a random sequence for two reasons:
  //
  // 1. Guarantee that `result` comes after `prev` (`result.length` >
  //    `prev.length`).
  //
  // 2. Guarantee that no two caller pick the same value even if they try to
  //    generate a stamp between the same values. This creates a (random) total
  //    order on the results of all parties with a very high probabili2ty.
  for (let j = 0; j < RANDOM_SUFFIX_LEN; ++j) {
    result += String.fromCharCode(randomInt(CHAR_CODE_MIN, CHAR_CODE_MAX));
  }
  return result;
}

/**
 * Returns the length of the common prefix between two strings.
 *
 * @param str1 - The first string to compare
 * @param str2 - The second string to compare
 * @returns The length of the common prefix shared by both strings
 */
export function commonPrefixLen(str1: string, str2: string): number {
  const len = Math.min(str1.length, str2.length);
  let end = 0;
  for (; end < len; ++end) {
    if (str1[end] !== str2[end]) {
      break;
    }
  }
  return end;
}

// min - inclusive, max - exclusive
// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#Getting_a_random_integer_between_two_values
export function randomInt(min: number, max: number): number {
  if (min === max) {
    return min;
  }
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}
