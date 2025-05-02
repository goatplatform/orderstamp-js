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
 *      differing characters
 *    - Add a random suffix to ensure uniqueness
 *
 * 3. **Numeric Conversion**:
 *    - Timestamps and indices are encoded using ELEN (Efficient Lexicographical
 *      Encoding of Numbers) by Peter Seymour
 *    - Random suffixes prevent collisions when multiple stamps are created
 *      concurrently
 *
 * Order stamps are specifically designed to preserve their relative ordering
 * when sorted lexicographically, a capability efficiently supported by most
 * databases and programming languages.
 */
import * as ELEN from "npm:elen@^1.0.10";

/**
 * The minimum character code used in order stamps.
 *
 * We use ASCII 33 ('!') as our minimum character code. This is the first printable
 * ASCII character after space, making it safe for use in databases, file systems,
 * and text processing while being visually distinct.
 */
export const CHAR_CODE_MIN = 33; // '!' character

/**
 * The maximum character code used in order stamps.
 *
 * We use ASCII 126 ('~') as our maximum character code. This gives us the full range
 * of printable ASCII characters while avoiding:
 * - Control characters (0-31)
 * - Space character (32)
 * - Delete character (127)
 * - Extended ASCII/Unicode characters (128+)
 *
 * This range provides 94 distinct characters (126-33+1), which is more than enough
 * for efficient ordering while ensuring compatibility across:
 * - All major databases
 * - File systems
 * - Text editors
 * - Network protocols
 * - Shell commands
 * - URL encoding
 */
export const CHAR_CODE_MAX = 126; // '~' character

/**
 * Returns a monotonically increasing order stamp at the end of the list which
 * can be used to append items at the end.
 *
 * This function uses the current timestamp to ensure that new insertions at
 * the end of the list naturally increase their position over time. This
 * approach maintains chronological ordering where newer items appear at the
 * end of the list. Each call to this function will return a stamp greater than
 * any previous call, ensuring strict ordering.
 */
export function end(): string {
  return from(newTimestamp());
}

/**
 * Returns a monotonically decreasing order stamp at the start of the list which
 * can be used to insert items at the beginning.
 *
 * This function uses the negative of the current timestamp to ensure that
 * new insertions at the start of the list will be ordered before existing items,
 * while maintaining a consistent approach with the end() function.
 */
export function start(): string {
  return from(-newTimestamp());
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
 * @param collisionProbability - The desired collision probability as a power of
 *                              2. For example, 64 means a probability of 2^64.
 *                              Defaults to 64 for practical collision
 *                              resistance in database operations.
 * @returns A string order stamp that preserves ordering
 */
export function from(
  value: number,
  key?: string,
  collisionProbability: number = 64,
): string {
  if (key === undefined) {
    key = "";
    const targetLogProbability = -Math.abs(collisionProbability) * Math.log(2);
    let logCollisionProbability = 0;
    while (logCollisionProbability > targetLogProbability) {
      key += String.fromCharCode(randomInt(CHAR_CODE_MIN, CHAR_CODE_MAX));
      logCollisionProbability += Math.log(1 / (CHAR_CODE_MAX - CHAR_CODE_MIN));
    }
  }
  return ELEN.encode(value) + key;
}

/**
 * Given two order stamps, this function generates and returns a value between
 * them. To generate values at the edges of the list, use the {@link start} and
 * {@link end} functions.
 *
 * This function ensures the returned value will sort lexicographically between
 * the two provided stamps, regardless of their original order. It adds random
 * characters to minimize collision probability in high-frequency operations.
 *
 * Note: You can pass the values in any order; the function will automatically
 * determine which one should be considered the "previous" and which the "next".
 *
 * @param prev - The first order stamp
 * @param next - The second order stamp
 * @param collisionProbability - The desired collision probability as a power of
 *                              2. For example, 64 means a probability of 2^64.
 *                              Defaults to 64 for practical collision
 *                              resistance in database operations.
 * @returns A new order stamp that sorts between the two input stamps
 * @throws Error if prev and next are identical (impossible to generate between
 *         identical values)
 */
export function between(
  prev: string,
  next: string,
  collisionProbability: number = 64,
): string {
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

  // Find the common prefix between the two stamps
  const prefixLen = commonPrefixLen(prev, next);

  // Start with the common prefix
  let result = prev.substring(0, prefixLen);

  // Get the first differing characters
  const prevCode = prev.charCodeAt(prefixLen) || CHAR_CODE_MIN;
  const nextCode = next.charCodeAt(prefixLen) || CHAR_CODE_MAX;

  // Calculate target collision probability
  const targetLogProbability = -Math.abs(collisionProbability) * Math.log(2);

  // If there's room between the characters
  if (prevCode < nextCode - 1) {
    // Calculate the middle character code
    const midCode = prevCode + Math.ceil((nextCode - prevCode) / 2);
    result += String.fromCharCode(midCode);

    // Calculate remaining entropy needed
    const initialEntropy = Math.log(1 / (nextCode - prevCode));
    const remainingEntropy = targetLogProbability - initialEntropy;
    const charsNeeded = Math.ceil(
      remainingEntropy / Math.log(1 / (CHAR_CODE_MAX - CHAR_CODE_MIN)),
    );

    // Add random characters to meet collision probability
    for (let i = 0; i < Math.max(0, charsNeeded); i++) {
      result += String.fromCharCode(randomInt(CHAR_CODE_MIN, CHAR_CODE_MAX));
    }
  } else {
    // If there's no room between characters, copy from prev and add random suffix
    result += String.fromCharCode(prevCode);
    let j = prefixLen + 1;
    let logCollisionProbability = 0;

    while (logCollisionProbability > targetLogProbability) {
      const prevCode = prev.charCodeAt(j) || CHAR_CODE_MIN;
      const nextCode = next.charCodeAt(j) || CHAR_CODE_MAX;
      ++j;

      if (prevCode < nextCode) {
        result += String.fromCharCode(randomInt(prevCode, nextCode));
        logCollisionProbability += Math.log(1 / (nextCode - prevCode));
      } else {
        result += String.fromCharCode(prevCode);
      }
    }
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

/**
 * Generates a random integer between min (inclusive) and max (exclusive).
 *
 * @param min - The minimum value (inclusive)
 * @param max - The maximum value (exclusive)
 * @returns A random integer in the specified range
 *
 * See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#Getting_a_random_integer_between_two_values
 */
export function randomInt(min: number, max: number): number {
  if (min === max) {
    return min;
  }
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

let gLastTimestamp = 0;
/**
 * Generates a unique timestamp by ensuring it differs from the last generated
 * timestamp. This function guarantees monotonic timestamps by waiting for the
 * system clock to advance if the current time matches the last generated
 * timestamp.
 *
 * @returns A unique timestamp in milliseconds since the Unix epoch
 */
export function newTimestamp(): number {
  let now = Date.now();
  while (now === gLastTimestamp) {
    now = Date.now();
  }
  gLastTimestamp = now;
  return now;
}
