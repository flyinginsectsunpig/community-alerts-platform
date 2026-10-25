import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";

// Runs in the node environment: there is no window, so getSession() is null
// and getFingerprint() returns "server" without any storage stubbing.
function stubFetch() {
  const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("api.updateDangerReach", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PUTs the chosen reach to the danger-reach endpoint", async () => {
    const fetchMock = stubFetch();

    await api.updateDangerReach(5000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.endsWith("/api/v1/auth/profile/danger-reach")).toBe(true);
    expect(init.method).toBe("PUT");
    expect(init.body).toBe('{"reachM":5000}');
  });

  it("sends a null reach to opt out", async () => {
    const fetchMock = stubFetch();

    await api.updateDangerReach(null);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(init.body).toBe('{"reachM":null}');
  });
});
