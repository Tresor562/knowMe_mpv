import { expect, test, type Page, type Route } from "@playwright/test";

type CapturedPayload = Record<string, unknown> | null;

type ApiState = {
  callPayload: CapturedPayload;
  preferencePayload: CapturedPayload;
  preferenceReads: number;
};

const user = {
  id: "user-e2e",
  email: "alpha@knowme.test",
  username: "alpha_tester",
  displayName: "Alpha Tester",
  knowCoins: 25,
};

const friend = {
  user: {
    id: "friend-e2e",
    username: "trusted_friend",
    displayName: "Ami Test",
  },
};

const initialPreferences = {
  userId: user.id,
  incomingCallsEnabled: true,
  allowAudioCalls: true,
  allowVideoCalls: true,
  quietHoursEnabled: false,
  quietStartMinute: 22 * 60,
  quietEndMinute: 7 * 60,
  timezone: "UTC",
  microphoneEnabledByDefault: true,
  cameraEnabledByDefault: true,
  devicePreviewRequired: true,
  version: 3,
  persisted: true,
  updatedAt: "2026-08-14T14:00:00.000Z",
};

type ApiOptions = {
  preferenceConflict?: boolean;
  preferenceOverrides?: Partial<typeof initialPreferences>;
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, content-type, accept-language",
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
};

async function fulfillJson(route: Route, value: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}

async function installApi(page: Page, options: ApiOptions = {}) {
  const preferences = {
    ...initialPreferences,
    ...options.preferenceOverrides,
  };
  const state: ApiState = {
    callPayload: null,
    preferencePayload: null,
    preferenceReads: 0,
  };

  await page.route("http://localhost:4000/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const pathname = new URL(request.url()).pathname;

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (method === "GET" && pathname === "/users/me") {
      await fulfillJson(route, user);
      return;
    }
    if (method === "GET" && pathname === "/social/friends") {
      await fulfillJson(route, [friend]);
      return;
    }
    if (method === "GET" && pathname === "/calls/history") {
      await fulfillJson(route, []);
      return;
    }
    if (method === "GET" && pathname === "/calls/preferences") {
      state.preferenceReads += 1;
      await fulfillJson(
        route,
        state.preferenceReads === 1
          ? preferences
          : {
              ...preferences,
              version: 4,
              updatedAt: "2026-08-14T14:05:00.000Z",
            },
      );
      return;
    }
    if (method === "PUT" && pathname === "/calls/preferences") {
      state.preferencePayload = request.postDataJSON() as Record<
        string,
        unknown
      >;
      if (options.preferenceConflict) {
        await fulfillJson(
          route,
          {
            code: "CALL_PREFERENCE_VERSION_CONFLICT",
            message: "Preference version conflict.",
            requestId: "request-e2e-conflict",
          },
          409,
        );
        return;
      }
      await fulfillJson(route, {
        ...preferences,
        ...state.preferencePayload,
        version: 4,
        updatedAt: "2026-08-14T14:05:00.000Z",
      });
      return;
    }
    if (method === "POST" && pathname === "/calls") {
      state.callPayload = request.postDataJSON() as Record<string, unknown>;
      await fulfillJson(route, {
        id: "call-e2e",
        direction: "OUTGOING",
        media: state.callPayload.media,
        status: "RINGING",
        peer: friend.user,
        answeredAt: null,
        endedAt: null,
        endReason: null,
        createdAt: "2026-08-14T14:10:00.000Z",
        policy: {
          serverIssuedCallId: true,
          sessionDescriptionsPersisted: false,
          iceCandidatesPersisted: false,
        },
      });
      return;
    }
    if (method === "GET" && pathname === "/calls/call-e2e/ice-configuration") {
      await fulfillJson(route, {
        callId: "call-e2e",
        iceServers: [{ urls: "stun:127.0.0.1:9" }],
        expiresAt: "2026-08-14T14:15:00.000Z",
        policy: {
          ephemeralCredentials: true,
          secretExposed: false,
          persistedCredential: false,
        },
      });
      return;
    }

    await fulfillJson(
      route,
      { code: "E2E_UNHANDLED_REQUEST", message: `${method} ${pathname}` },
      404,
    );
  });

  return state;
}

async function installSessionAndMediaProbe(
  page: Page,
  failureName: string | null = null,
) {
  await page.addInitScript(
    ({ forcedFailure }) => {
      window.localStorage.setItem("knowme_token", "e2e-access-token");

      const probe = window as Window & {
        __knowmeMediaRequests?: Array<MediaStreamConstraints | undefined>;
        __knowmeLastStream?: MediaStream;
      };
      probe.__knowmeMediaRequests = [];

      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.getUserMedia) return;
      const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);

      mediaDevices.getUserMedia = async (constraints) => {
        probe.__knowmeMediaRequests?.push(constraints);
        if (forcedFailure) {
          throw new DOMException("Forced E2E media failure.", forcedFailure);
        }
        const stream = await originalGetUserMedia(constraints);
        probe.__knowmeLastStream = stream;
        return stream;
      };
    },
    { forcedFailure: failureName },
  );
}

async function mediaProbe(page: Page) {
  return page.evaluate(() => {
    const probe = window as Window & {
      __knowmeMediaRequests?: Array<MediaStreamConstraints | undefined>;
      __knowmeLastStream?: MediaStream;
    };
    const preview = document.querySelector(
      'video[aria-label="Aperçu vidéo local"]',
    ) as HTMLVideoElement | null;
    const previewStream = preview?.srcObject as MediaStream | null;
    return {
      requestCount: probe.__knowmeMediaRequests?.length ?? 0,
      constraints: probe.__knowmeMediaRequests?.at(-1) ?? null,
      audioTracks: previewStream?.getAudioTracks().length ?? 0,
      videoTracks: previewStream?.getVideoTracks().length ?? 0,
      previewAttached: Boolean(previewStream),
      trackCount: probe.__knowmeLastStream?.getTracks().length ?? 0,
      liveTrackCount:
        probe.__knowmeLastStream
          ?.getTracks()
          .filter((track) => track.readyState !== "ended").length ?? 0,
    };
  });
}

test("gates a video call behind an explicit local preview and sends no device metadata", async ({
  page,
}) => {
  const api = await installApi(page);
  await installSessionAndMediaProbe(page);

  await page.goto("/calls");
  await expect(
    page.getByRole("heading", { name: "Appels KnowMe" }),
  ).toBeVisible();
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();

  const videoCall = page.getByRole("button", { name: "Appel vidéo" });
  await page.getByLabel("Choisir un contact").selectOption(friend.user.id);
  await expect(videoCall).toBeDisabled();
  expect((await mediaProbe(page)).requestCount).toBe(0);

  await page.getByRole("button", { name: "Tester mes appareils" }).click();
  await expect(page.getByText("Appareils prêts")).toBeVisible();
  await expect(page.getByText(/Aperçu audio et vidéo prêt\./)).toBeVisible();

  const prepared = await mediaProbe(page);
  expect(prepared.requestCount).toBe(1);
  expect(prepared.constraints?.audio).toBeTruthy();
  expect(prepared.constraints?.video).toBeTruthy();
  expect(prepared.audioTracks).toBeGreaterThan(0);
  expect(prepared.videoTracks).toBeGreaterThan(0);
  expect(prepared.previewAttached).toBe(true);
  await expect(videoCall).toBeEnabled();

  await videoCall.click();
  await expect(
    page.getByText("Appel en cours · relais éphémère prêt"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Terminer" })).toBeEnabled();

  expect(api.callPayload).toEqual({
    calleeUserId: friend.user.id,
    media: "video",
    idempotencyKey: expect.stringMatching(/^web-call-create:/),
  });
  expect(JSON.stringify(api.callPayload)).not.toMatch(
    /device|microphone|camera|permission|candidate|sdp/i,
  );

  await page.getByRole("button", { name: "Terminer" }).click();
  await expect(videoCall).toBeDisabled();
  await expect
    .poll(async () => mediaProbe(page))
    .toMatchObject({
      previewAttached: false,
      trackCount: 2,
      liveTrackCount: 0,
    });
});

test("shows a privacy-safe denied state only after the preparation action", async ({
  page,
}) => {
  await installApi(page);
  await installSessionAndMediaProbe(page, "NotAllowedError");

  await page.goto("/calls");
  await expect(
    page.getByRole("heading", { name: "Appels KnowMe" }),
  ).toBeVisible();
  expect((await mediaProbe(page)).requestCount).toBe(0);

  await page.getByRole("button", { name: "Tester mes appareils" }).click();
  await expect(
    page.getByText("Permission refusée", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Autorise le microphone ou la caméra dans le navigateur/),
  ).toBeVisible();
  expect((await mediaProbe(page)).requestCount).toBe(1);
});

test("recovers a version conflict without leaking local preparation state", async ({
  page,
}) => {
  const api = await installApi(page, { preferenceConflict: true });
  await installSessionAndMediaProbe(page);

  await page.goto("/calls");
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();
  await page.getByLabel("Recevoir des appels").uncheck();
  await page.getByLabel("Fuseau horaire IANA").fill("Africa/Porto-Novo");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(
    page.getByText(/La version récente a été rechargée/),
  ).toBeVisible();
  await expect(page.getByText("Version 4 · enregistrée")).toBeVisible();
  await expect(page.getByLabel("Recevoir des appels")).toBeChecked();
  expect(api.preferenceReads).toBe(2);
  expect(api.preferencePayload).toEqual({
    incomingCallsEnabled: false,
    allowAudioCalls: true,
    allowVideoCalls: true,
    quietHoursEnabled: false,
    quietStartMinute: 22 * 60,
    quietEndMinute: 7 * 60,
    timezone: "Africa/Porto-Novo",
    microphoneEnabledByDefault: true,
    cameraEnabledByDefault: true,
    devicePreviewRequired: true,
    expectedVersion: 3,
  });
  expect(JSON.stringify(api.preferencePayload)).not.toMatch(
    /deviceId|permission|previewStream|mediaStream/i,
  );
  expect((await mediaProbe(page)).requestCount).toBe(0);
});

test("invalidates a prepared video preview when the local mode changes", async ({
  page,
}) => {
  const api = await installApi(page);
  await installSessionAndMediaProbe(page);

  await page.goto("/calls");
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();
  await page.getByLabel("Choisir un contact").selectOption(friend.user.id);
  await page.getByRole("button", { name: "Tester mes appareils" }).click();
  await expect(page.getByText("Appareils prêts")).toBeVisible();

  await page.getByLabel("Mode à préparer").selectOption("audio");
  await expect(
    page.getByText("Mode modifié. Lance le test local."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Appel audio" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Appel vidéo" }),
  ).toBeDisabled();
  await expect
    .poll(async () => mediaProbe(page))
    .toMatchObject({
      requestCount: 1,
      previewAttached: false,
      trackCount: 2,
      liveTrackCount: 0,
    });

  await page.getByRole("button", { name: "Tester mes appareils" }).click();
  await expect(page.getByText(/Aperçu audio prêt\./)).toBeVisible();

  const prepared = await mediaProbe(page);
  expect(prepared.requestCount).toBe(2);
  expect(prepared.constraints?.audio).toBeTruthy();
  expect(prepared.constraints?.video).toBeFalsy();
  expect(prepared.audioTracks).toBeGreaterThan(0);
  expect(prepared.videoTracks).toBe(0);
  await expect(page.getByRole("button", { name: "Appel audio" })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Appel vidéo" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Appel audio" }).click();
  await expect(
    page.getByText("Appel en cours · relais éphémère prêt"),
  ).toBeVisible();
  expect(api.callPayload).toEqual({
    calleeUserId: friend.user.id,
    media: "audio",
    idempotencyKey: expect.stringMatching(/^web-call-create:/),
  });
  expect(JSON.stringify(api.callPayload)).not.toMatch(
    /device|microphone|camera|permission|candidate|sdp/i,
  );

  await page.getByRole("button", { name: "Terminer" }).click();
  await expect
    .poll(async () => mediaProbe(page))
    .toMatchObject({
      previewAttached: false,
      trackCount: 1,
      liveTrackCount: 0,
    });
});

test("defers optional preview media access until the explicit call action", async ({
  page,
}) => {
  const api = await installApi(page, {
    preferenceOverrides: { devicePreviewRequired: false },
  });
  await installSessionAndMediaProbe(page);

  await page.goto("/calls");
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();
  await page.getByLabel("Choisir un contact").selectOption(friend.user.id);

  const audioCall = page.getByRole("button", { name: "Appel audio" });
  await expect(audioCall).toBeEnabled();
  await expect(page.getByRole("button", { name: "Appel vidéo" })).toBeEnabled();
  expect((await mediaProbe(page)).requestCount).toBe(0);

  await audioCall.click();
  await expect(
    page.getByText("Appel en cours · relais éphémère prêt"),
  ).toBeVisible();

  const active = await mediaProbe(page);
  expect(active.requestCount).toBe(1);
  expect(active.constraints?.audio).toBeTruthy();
  expect(active.constraints?.video).toBeFalsy();
  expect(active.audioTracks).toBeGreaterThan(0);
  expect(active.videoTracks).toBe(0);
  expect(active.previewAttached).toBe(true);
  expect(api.callPayload).toEqual({
    calleeUserId: friend.user.id,
    media: "audio",
    idempotencyKey: expect.stringMatching(/^web-call-create:/),
  });
  expect(JSON.stringify(api.callPayload)).not.toMatch(
    /device|microphone|camera|permission|candidate|sdp/i,
  );

  await page.getByRole("button", { name: "Terminer" }).click();
  await expect
    .poll(async () => mediaProbe(page))
    .toMatchObject({
      previewAttached: false,
      trackCount: 1,
      liveTrackCount: 0,
    });
});
