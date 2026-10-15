import { expect, it } from "vitest";

import { analyzeJavaScriptSemantics } from "./javascriptSemanticAnalysis.js";

it("keeps overflowing timer delays explicit without publishing nonfinite JSON", () => {
  const ir = analyzeJavaScriptSemantics(`
    function greet() { return "hello"; }
    setTimeout(() => greet(), 1e999);
  `);

  expect(ir.timerOperations).toEqual([
    expect.objectContaining({
      kind: "schedule",
      method: "setTimeout",
      delayMilliseconds: null,
      resolution: "complete",
    }),
  ]);
  expect(ir.callables.some(({ name }) => name === "greet")).toBe(true);
});

it("keeps finite timer delays unchanged", () => {
  const ir = analyzeJavaScriptSemantics("setTimeout(work, 100);");

  expect(ir.timerOperations).toEqual([
    expect.objectContaining({
      kind: "schedule",
      method: "setTimeout",
      delayMilliseconds: 100,
      resolution: "complete",
    }),
  ]);
});
