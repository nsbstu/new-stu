import { describe, expect, it } from "vitest";
import { modelEndpoint, normalizeModelBaseUrl } from "./modelSettings";

describe("model API URL normalization", () => {
  it("adds /v1 when only a provider origin is entered", () => {
    expect(normalizeModelBaseUrl("https://vvcode.top")).toBe("https://vvcode.top/v1");
  });

  it("keeps an explicit API path", () => {
    expect(normalizeModelBaseUrl("https://openrouter.ai/api/v1/")).toBe("https://openrouter.ai/api/v1");
  });

  it("builds the chat completions endpoint", () => {
    expect(modelEndpoint("https://vvcode.top", "/chat/completions")).toBe("https://vvcode.top/v1/chat/completions");
  });
});
