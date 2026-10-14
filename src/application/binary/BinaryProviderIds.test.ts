import { expect, it } from "vitest";
import {
  assertBinaryLaneProviderIds,
  BINARY_ANALYSIS_PROVIDER_IDS,
} from "./BinaryProviderIds.js";

/** The published lane must match the providers wired in `createBinarySession`. */
it("accepts the wired binary providers", () => {
  expect(() =>
    assertBinaryLaneProviderIds([...BINARY_ANALYSIS_PROVIDER_IDS]),
  ).not.toThrow();
  expect(() =>
    assertBinaryLaneProviderIds(["ida", "hopper", "ghidra"]),
  ).not.toThrow();
});

it("fails loudly on lane drift instead of emitting stale guidance", () => {
  expect(() => assertBinaryLaneProviderIds(["hopper", "ghidra"])).toThrow(
    /missing ida/,
  );
  expect(() =>
    assertBinaryLaneProviderIds(["hopper", "ghidra", "ida", "jeb"]),
  ).toThrow(/unexpected jeb/);
});
