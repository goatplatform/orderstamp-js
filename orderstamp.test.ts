import { assertEquals, assertThrows } from "jsr:@std/assert";
import * as orderstamp from "./orderstamp.ts";

Deno.test("from() creates ordered stamps from numbers", () => {
  const stamp1 = orderstamp.from(100);
  const stamp2 = orderstamp.from(200);
  const stamp3 = orderstamp.from(150);

  assertTrue(stamp1 < stamp2);
  assertTrue(stamp1 < stamp3);
  assertTrue(stamp3 < stamp2);
});

Deno.test("from() with custom key preserves ordering", () => {
  const stamp1 = orderstamp.from(100, "abc");
  const stamp2 = orderstamp.from(200, "xyz");

  assertTrue(stamp1 < stamp2);
  assertEquals(stamp1.endsWith("abc"), true);
  assertEquals(stamp2.endsWith("xyz"), true);
});

Deno.test("between() generates stamps that sort correctly", () => {
  const stamp1 = orderstamp.from(100);
  const stamp2 = orderstamp.from(200);

  const between = orderstamp.between(stamp1, stamp2);
  assertTrue(stamp1 < between);
  assertTrue(between < stamp2);
});

Deno.test("between() works with reversed arguments", () => {
  const stamp1 = orderstamp.from(100);
  const stamp2 = orderstamp.from(200);

  const between = orderstamp.between(stamp2, stamp1);
  assertTrue(stamp1 < between);
  assertTrue(between < stamp2);
});

Deno.test("between() throws on identical stamps", () => {
  const stamp = orderstamp.from(100);
  assertThrows(
    () => orderstamp.between(stamp, stamp),
    Error,
    "prev and next must be different",
  );
});

Deno.test("between() generates unique values", () => {
  const stamp1 = orderstamp.from(100);
  const stamp2 = orderstamp.from(200);

  const between1 = orderstamp.between(stamp1, stamp2);
  const between2 = orderstamp.between(stamp1, stamp2);

  assertNotEquals(between1, between2);
  assertTrue(stamp1 < between1);
  assertTrue(between1 < stamp2);
  assertTrue(stamp1 < between2);
  assertTrue(between2 < stamp2);
});

Deno.test("commonPrefixLen() returns correct length", () => {
  assertEquals(orderstamp.commonPrefixLen("abc", "abd"), 2);
  assertEquals(orderstamp.commonPrefixLen("abc", "abc"), 3);
  assertEquals(orderstamp.commonPrefixLen("abc", "def"), 0);
  assertEquals(orderstamp.commonPrefixLen("abc", "ab"), 2);
  assertEquals(orderstamp.commonPrefixLen("", "abc"), 0);
  assertEquals(orderstamp.commonPrefixLen("", ""), 0);
});

Deno.test("randomInt() generates numbers in correct range", () => {
  for (let i = 0; i < 1000; i++) {
    const num = orderstamp.randomInt(1, 10);
    assertTrue(num >= 1);
    assertTrue(num < 10);
  }
});

Deno.test("randomInt() for identical min and max", () => {
  const num = orderstamp.randomInt(1, 1);
  assertEquals(num, 1);
});

Deno.test("start() returns a value that works with between()", () => {
  const start = orderstamp.start();
  const end = orderstamp.from(100);

  const between = orderstamp.between(start, end);
  assertTrue(start < between);
  assertTrue(between < end);
});

Deno.test("end() returns a value that works with between()", () => {
  const start = orderstamp.from(100);
  const end = orderstamp.end();

  const between = orderstamp.between(start, end);
  assertTrue(start < between);
  assertTrue(between < end);
});

Deno.test("start() and end() work together with between()", () => {
  const start = orderstamp.start();
  const end = orderstamp.end();
  const between = orderstamp.between(start, end);
  assertTrue(start < between);
  assertTrue(between < end);
});

Deno.test("multiple calls to start() and end() produce different values but maintain order", () => {
  const start1 = orderstamp.start();
  const start2 = orderstamp.start();
  const end1 = orderstamp.end();
  const end2 = orderstamp.end();

  // Different values due to randomization
  assertNotEquals(start1, start2);
  assertNotEquals(end1, end2);

  // Both start values work with between
  const between1 = orderstamp.between(start1, end1);
  const between2 = orderstamp.between(start2, end1);

  assertTrue(start1 < between1);
  assertTrue(between1 < end1);
  assertTrue(start2 < between2);
  assertTrue(between2 < end1);

  // Both end values work with between
  const between3 = orderstamp.between(start1, end1);
  const between4 = orderstamp.between(start1, end2);

  assertTrue(start1 < between3);
  assertTrue(between3 < end1);
  assertTrue(start1 < between4);
  assertTrue(between4 < end2);
});

Deno.test("start() returns a value that comes before end()", () => {
  const start = orderstamp.start();
  const end = orderstamp.end();

  // Verify that start is lexicographically before end
  assertTrue(start < end);

  // Additional verification that they're different values
  assertNotEquals(start, end);

  // Ensure we can create values between them
  const middle = orderstamp.between(start, end);
  assertTrue(start < middle);
  assertTrue(middle < end);
});

Deno.test("between() works when prev is a prefix of next", () => {
  // Create a situation where prev is a prefix of next
  const stamp1 = orderstamp.from(100, ""); // Empty key to control the suffix
  const stamp2 = stamp1 + "ABC"; // Make stamp2 have stamp1 as its prefix

  // Verify our test setup is correct
  assertEquals(orderstamp.commonPrefixLen(stamp1, stamp2), stamp1.length);
  assertTrue(stamp1.length < stamp2.length);

  // Test the between function with this specific case
  const between = orderstamp.between(stamp1, stamp2);

  // Verify the result sorts correctly
  assertTrue(stamp1 < between);
  assertTrue(between < stamp2);
});

Deno.test("between() works with same-length stamps differing at the end", () => {
  // Create two stamps of the same length that differ only in the last character
  const base = "ABCDEFGHIJK";
  const stamp1 = base + "L";
  const stamp2 = base + "Z";

  // Verify our test setup is correct
  assertEquals(orderstamp.commonPrefixLen(stamp1, stamp2), base.length);
  assertEquals(stamp1.length, stamp2.length);

  // Test the between function
  const between = orderstamp.between(stamp1, stamp2);

  // Verify the result sorts correctly
  assertTrue(stamp1 < between);
  assertTrue(between < stamp2);
});

Deno.test("between() works with hard-coded values having a common prefix", () => {
  // Hard-coded values with a common prefix "ABC"
  const stamp1 = "ABCDEF";
  const stamp2 = "ABCXYZ";

  // Verify our test setup is correct
  assertEquals(orderstamp.commonPrefixLen(stamp1, stamp2), 3);
  assertTrue(stamp1 < stamp2);

  // Test the between function with these values
  const between = orderstamp.between(stamp1, stamp2);

  // Verify the result sorts correctly
  assertTrue(stamp1 < between);
  assertTrue(between < stamp2);

  // Additional verification that the result has the same prefix
  assertEquals(between.substring(0, 3), "ABC");
});

Deno.test("end() generates monotonically increasing stamps", () => {
  // Generate multiple stamps with end() in sequence
  const stamp1 = orderstamp.end();

  // Small delay to ensure timestamp changes
  shortSleep();

  const stamp2 = orderstamp.end();

  // Another small delay
  shortSleep();

  const stamp3 = orderstamp.end();

  // Verify that each stamp is greater than the previous one
  assertTrue(stamp1 < stamp2);
  assertTrue(stamp2 < stamp3);

  // Verify that all stamps are different
  assertNotEquals(stamp1, stamp2);
  assertNotEquals(stamp2, stamp3);
  assertNotEquals(stamp1, stamp3);
});

Deno.test("start() generates monotonically decreasing stamps", () => {
  // Generate multiple stamps with start() in sequence
  const stamp1 = orderstamp.start();

  // Small delay to ensure timestamp changes
  shortSleep();

  const stamp2 = orderstamp.start();

  // Another small delay
  shortSleep();

  const stamp3 = orderstamp.start();

  // Verify that each stamp is less than the previous one
  assertTrue(stamp1 > stamp2);
  assertTrue(stamp2 > stamp3);

  // Verify that all stamps are different
  assertNotEquals(stamp1, stamp2);
  assertNotEquals(stamp2, stamp3);
  assertNotEquals(stamp1, stamp3);
});

// Helper function for tests
function assertTrue(condition: boolean) {
  assertEquals(condition, true);
}

function assertNotEquals(actual: unknown, expected: unknown) {
  assertEquals(
    actual !== expected,
    true,
    `Expected values to be different, but both were: ${actual}`,
  );
}

function shortSleep() {
  const prev = performance.now();
  while (true) {
    if (performance.now() !== prev) {
      return;
    }
  }
}
