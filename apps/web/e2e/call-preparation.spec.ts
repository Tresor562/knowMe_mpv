import { expect, test, type Page, type Route } from "@playwright/test";

type CapturedPayload = Record<string, unknown> | null;

type ApiState = {
  callEndPayload: CapturedPayload;
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
  callCreateFailure?: boolean;
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
    callEndPayload: null,
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
      if (options.callCreateFailure) {
        await fulfillJson(
          route,
          {
            code: "CALL_RECIPIENT_UNAVAILABLE",
            message:
              "Cette personne ne peut pas recevoir cet appel actuellement.",
            requestId: "request-e2e-unavailable",
          },
          409,
        );
        return;
      }
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
    if (method === "POST" && pathname === "/calls/call-e2e/end") {
      state.callEndPayload = request.postDataJSON() as Record<string, unknown>;
      await fulfillJson(route, {
        id: "call-e2e",
        direction: "OUTGOING",
        media: state.callPayload?.media ?? "audio",
        status: "ENDED",
        peer: friend.user,
        answeredAt: null,
        endedAt: "2026-08-14T14:11:00.000Z",
        endReason: state.callEndPayload.reason,
        createdAt: "2026-08-14T14:10:00.000Z",
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
  failuresBeforeSuccess: number | null = null,
) {
  await page.addInitScript(
    ({ forcedFailure, initialFailuresBeforeSuccess }) => {
      window.localStorage.setItem("knowme_token", "e2e-access-token");

      const probe = window as Window & {
        __knowmeMediaRequests?: Array<MediaStreamConstraints | undefined>;
        __knowmeLastStream?: MediaStream;
      };
      probe.__knowmeMediaRequests = [];

      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.getUserMedia) return;
      const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
      let failuresRemaining = initialFailuresBeforeSuccess;

      mediaDevices.getUserMedia = async (constraints) => {
        probe.__knowmeMediaRequests?.push(constraints);
        if (
          forcedFailure &&
          (failuresRemaining === null || failuresRemaining > 0)
        ) {
          if (failuresRemaining !== null) failuresRemaining -= 1;
          throw new DOMException("Forced E2E media failure.", forcedFailure);
        }
        const stream = await originalGetUserMedia(constraints);
        probe.__knowmeLastStream = stream;
        return stream;
      };
    },
    {
      forcedFailure: failureName,
      initialFailuresBeforeSuccess: failuresBeforeSuccess,
    },
  );
}

async function installRealtimeProbe(page: Page) {
  const clientMessages: string[] = [];
  let sendToClient: ((message: string) => void) | null = null;
  let namespaceConnected = false;

  await page.routeWebSocket("ws://localhost:4000/**", (webSocket) => {
    webSocket.onMessage((message) => {
      const text =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);
      clientMessages.push(text);
      if (text.startsWith("40/realtime")) {
        webSocket.send('40/realtime,{"sid":"e2e-realtime"}');
        namespaceConnected = true;
      }
    });
    sendToClient = (message) => webSocket.send(message);
    webSocket.send(
      '0{"sid":"e2e-engine","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}',
    );
  });

  return {
    async emitIncoming() {
      await expect.poll(() => namespaceConnected).toBe(true);
      sendToClient?.(
        "42/realtime," +
          JSON.stringify([
            "call:incoming",
            {
              callId: "call-e2e",
              callerUserId: friend.user.id,
              callerUsername: friend.user.username,
              offer: { type: "offer", sdp: "v=0\\r\\n" },
              media: "video",
            },
          ]),
      );
    },
    emittedEvents() {
      return clientMessages
        .filter((message) => message.startsWith("42/realtime,"))
        .map((message) => JSON.parse(message.slice("42/realtime,".length)));
    },
  };
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
      audioTrackEnabled:
        previewStream?.getAudioTracks().map((track) => track.enabled) ?? [],
      videoTrackEnabled:
        previewStream?.getVideoTracks().map((track) => track.enabled) ?? [],
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

test("recovers local preparation after an initial permission denial", async ({
  page,
}) => {
  await installApi(page);
  await installSessionAndMediaProbe(page, "NotAllowedError", 1);

  await page.goto("/calls");
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();
  await page.getByLabel("Choisir un contact").selectOption(friend.user.id);

  const videoCall = page.getByRole("button", { name: "Appel vidéo" });
  const prepare = page.getByRole("button", { name: "Tester mes appareils" });
  await expect(videoCall).toBeDisabled();

  await prepare.click();
  await expect(
    page.getByText("Permission refusée", { exact: true }),
  ).toBeVisible();
  expect(await mediaProbe(page)).toMatchObject({
    requestCount: 1,
    previewAttached: false,
    liveTrackCount: 0,
  });
  await expect(videoCall).toBeDisabled();

  await prepare.click();
  await expect(page.getByText("Appareils prêts")).toBeVisible();
  await expect(page.getByText(/Aperçu audio et vidéo prêt\./)).toBeVisible();
  expect(await mediaProbe(page)).toMatchObject({
    requestCount: 2,
    audioTracks: 1,
    videoTracks: 1,
    previewAttached: true,
    liveTrackCount: 2,
  });
  await expect(videoCall).toBeEnabled();

  await page.getByRole("button", { name: "Arrêter l’aperçu" }).click();
  await expect
    .poll(async () => mediaProbe(page))
    .toMatchObject({ previewAttached: false, liveTrackCount: 0 });
});

test("applies local microphone and camera controls without reacquiring media", async ({
  page,
}) => {
  await installApi(page);
  await installSessionAndMediaProbe(page);

  await page.goto("/calls");
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();
  await page.getByLabel("Choisir un contact").selectOption(friend.user.id);
  await page.getByRole("button", { name: "Tester mes appareils" }).click();
  await expect(page.getByText("Appareils prêts")).toBeVisible();

  const microphone = page.getByLabel("Micro actif", { exact: true });
  const camera = page.getByLabel("Caméra active", { exact: true });
  await microphone.uncheck();
  await camera.uncheck();

  expect(await mediaProbe(page)).toMatchObject({
    requestCount: 1,
    audioTrackEnabled: [false],
    videoTrackEnabled: [false],
    liveTrackCount: 2,
  });
  await expect(page.getByRole("button", { name: "Appel vidéo" })).toBeEnabled();

  await microphone.check();
  await camera.check();
  expect(await mediaProbe(page)).toMatchObject({
    requestCount: 1,
    audioTrackEnabled: [true],
    videoTrackEnabled: [true],
    liveTrackCount: 2,
  });

  await page.getByRole("button", { name: "Arrêter l’aperçu" }).click();
  await expect
    .poll(async () => mediaProbe(page))
    .toMatchObject({ previewAttached: false, liveTrackCount: 0 });
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

test("preserves server admission authority without opening local media", async ({
  page,
}) => {
  const api = await installApi(page, {
    callCreateFailure: true,
    preferenceOverrides: { devicePreviewRequired: false },
  });
  await installSessionAndMediaProbe(page);

  await page.goto("/calls");
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();
  await page.getByLabel("Choisir un contact").selectOption(friend.user.id);

  const audioCall = page.getByRole("button", { name: "Appel audio" });
  await expect(audioCall).toBeEnabled();
  await audioCall.click();

  await expect(page.locator("header").getByRole("status")).toContainText(
    "Cette personne ne peut pas recevoir cet appel actuellement.",
  );
  expect(api.callPayload).toEqual({
    calleeUserId: friend.user.id,
    media: "audio",
    idempotencyKey: expect.stringMatching(/^web-call-create:/),
  });
  expect(api.callEndPayload).toBeNull();
  expect((await mediaProbe(page)).requestCount).toBe(0);
  await expect(audioCall).toBeEnabled();
  await expect(page.getByRole("button", { name: "Terminer" })).toBeDisabled();
});

test("cancels the server call when explicit media access fails", async ({
  page,
}) => {
  const api = await installApi(page, {
    preferenceOverrides: { devicePreviewRequired: false },
  });
  await installSessionAndMediaProbe(page, "NotAllowedError");

  await page.goto("/calls");
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();
  await page.getByLabel("Choisir un contact").selectOption(friend.user.id);

  const audioCall = page.getByRole("button", { name: "Appel audio" });
  await audioCall.click();

  await expect(page.locator("header").getByRole("status")).toContainText(
    "Permission refusée",
  );
  await expect.poll(() => api.callEndPayload).toEqual({ reason: "cancelled" });
  expect(api.callPayload).toEqual({
    calleeUserId: friend.user.id,
    media: "audio",
    idempotencyKey: expect.stringMatching(/^web-call-create:/),
  });
  expect(
    JSON.stringify({ call: api.callPayload, end: api.callEndPayload }),
  ).not.toMatch(/device|microphone|camera|candidate|sdp/i);
  expect(await mediaProbe(page)).toMatchObject({
    requestCount: 1,
    previewAttached: false,
    trackCount: 0,
    liveTrackCount: 0,
  });
  await expect(audioCall).toBeEnabled();
  await expect(page.getByRole("button", { name: "Terminer" })).toBeDisabled();
});

test("saves explicit availability choices without requesting local media", async ({
  page,
}) => {
  const api = await installApi(page);
  await installSessionAndMediaProbe(page);

  await page.goto("/calls");
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();
  await page.getByLabel("Recevoir des appels").uncheck();
  await page.getByLabel("Autoriser la vidéo").uncheck();
  await page.getByLabel("Activer les heures calmes").check();
  await page.getByLabel("Début du silence").fill("21:15");
  await page.getByLabel("Fin du silence").fill("06:45");
  await page.getByLabel("Fuseau horaire IANA").fill("Africa/Porto-Novo");
  await page.getByLabel("Micro actif par défaut").uncheck();
  await page.getByLabel("Caméra active par défaut").uncheck();
  await page.getByLabel("Test obligatoire avant l’appel").uncheck();

  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByText("Version 4 · enregistrée")).toBeVisible();
  expect(api.preferencePayload).toEqual({
    incomingCallsEnabled: false,
    allowAudioCalls: true,
    allowVideoCalls: false,
    quietHoursEnabled: true,
    quietStartMinute: 21 * 60 + 15,
    quietEndMinute: 6 * 60 + 45,
    timezone: "Africa/Porto-Novo",
    microphoneEnabledByDefault: false,
    cameraEnabledByDefault: false,
    devicePreviewRequired: false,
    expectedVersion: 3,
  });
  expect(JSON.stringify(api.preferencePayload)).not.toMatch(
    /deviceId|permission|previewStream|mediaStream/i,
  );
  expect((await mediaProbe(page)).requestCount).toBe(0);
  await expect(page.getByLabel("Recevoir des appels")).not.toBeChecked();
  await expect(
    page.getByLabel("Test obligatoire avant l’appel"),
  ).not.toBeChecked();
});

test("stops a voluntary preview and restores the required call gate", async ({
  page,
}) => {
  await installApi(page);
  await installSessionAndMediaProbe(page);

  await page.goto("/calls");
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();
  await page.getByLabel("Choisir un contact").selectOption(friend.user.id);

  const audioCall = page.getByRole("button", { name: "Appel audio" });
  const videoCall = page.getByRole("button", { name: "Appel vidéo" });
  const stopPreview = page.getByRole("button", { name: "Arrêter l’aperçu" });
  await page.getByRole("button", { name: "Tester mes appareils" }).click();
  await expect(page.getByText("Appareils prêts")).toBeVisible();
  await expect(stopPreview).toBeEnabled();
  await expect(audioCall).toBeEnabled();
  await expect(videoCall).toBeEnabled();

  await stopPreview.click();

  await expect(page.getByText("Aperçu local arrêté.")).toBeVisible();
  await expect(stopPreview).toBeDisabled();
  await expect(audioCall).toBeDisabled();
  await expect(videoCall).toBeDisabled();
  await expect
    .poll(async () => mediaProbe(page))
    .toMatchObject({
      requestCount: 1,
      previewAttached: false,
      trackCount: 2,
      liveTrackCount: 0,
    });
});

test("stops an inactive preview when KnowMe moves to the background", async ({
  page,
}) => {
  await installApi(page);
  await installSessionAndMediaProbe(page);

  await page.goto("/calls");
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();
  await page.getByLabel("Choisir un contact").selectOption(friend.user.id);
  await page.getByRole("button", { name: "Tester mes appareils" }).click();
  await expect(page.getByText("Appareils prêts")).toBeVisible();
  expect(await mediaProbe(page)).toMatchObject({
    previewAttached: true,
    liveTrackCount: 2,
  });

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect(
    page.getByText(
      "Aperçu local arrêté lorsque KnowMe est passé en arrière-plan.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Appel audio" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Appel vidéo" })).toBeDisabled();
  await expect
    .poll(async () => mediaProbe(page))
    .toMatchObject({
      requestCount: 1,
      previewAttached: false,
      trackCount: 2,
      liveTrackCount: 0,
    });
});

test("gates an incoming video call behind preparation and cleans up on refusal", async ({
  page,
}) => {
  await installApi(page);
  await installSessionAndMediaProbe(page);
  const realtime = await installRealtimeProbe(page);

  await page.goto("/calls");
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();
  await realtime.emitIncoming();

  await expect(
    page.getByRole("heading", { name: "Appel entrant" }),
  ).toBeVisible();
  await expect(
    page.getByText("trusted_friend souhaite lancer un appel vidéo."),
  ).toBeVisible();
  expect((await mediaProbe(page)).requestCount).toBe(0);

  const accept = page.getByRole("button", { name: "Accepter" });
  await expect(accept).toBeDisabled();
  await page
    .getByRole("button", { name: "Préparer audio et vidéo" })
    .click();
  await expect(page.getByText("Appareils prêts")).toBeVisible();
  await expect(accept).toBeEnabled();
  expect(await mediaProbe(page)).toMatchObject({
    requestCount: 1,
    previewAttached: true,
    liveTrackCount: 2,
  });

  await page.getByRole("button", { name: "Refuser" }).click();
  await expect(page.getByText("Appel refusé", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Appel entrant" }),
  ).not.toBeVisible();
  await expect
    .poll(async () => mediaProbe(page))
    .toMatchObject({
      previewAttached: false,
      trackCount: 2,
      liveTrackCount: 0,
    });
  await expect
    .poll(() => realtime.emittedEvents())
    .toContainEqual([
      "call:end",
      {
        targetUserId: friend.user.id,
        callId: "call-e2e",
        reason: "rejected",
      },
    ]);
  expect(JSON.stringify(realtime.emittedEvents())).not.toMatch(
    /device|microphone|camera|permission|candidate|sdp/i,
  );
});

test("keeps active call media live when KnowMe moves to the background", async ({
  page,
}) => {
  await installApi(page);
  await installSessionAndMediaProbe(page);

  await page.goto("/calls");
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();
  await page.getByLabel("Choisir un contact").selectOption(friend.user.id);
  await page.getByRole("button", { name: "Tester mes appareils" }).click();
  await expect(page.getByText("Appareils prêts")).toBeVisible();
  await page.getByRole("button", { name: "Appel vidéo" }).click();
  await expect(
    page.getByText("Appel en cours · relais éphémère prêt"),
  ).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  expect(await mediaProbe(page)).toMatchObject({
    requestCount: 1,
    previewAttached: true,
    liveTrackCount: 2,
  });
  await expect(page.getByRole("button", { name: "Terminer" })).toBeEnabled();

  await page.getByRole("button", { name: "Terminer" }).click();
  await expect
    .poll(async () => mediaProbe(page))
    .toMatchObject({ previewAttached: false, liveTrackCount: 0 });
});

test("releases preview media when leaving the calls route", async ({ page }) => {
  await installApi(page);
  await installSessionAndMediaProbe(page);

  await page.goto("/calls");
  await expect(page.getByText("Version 3 · enregistrée")).toBeVisible();
  await page.getByRole("button", { name: "Tester mes appareils" }).click();
  await expect(page.getByText("Appareils prêts")).toBeVisible();
  expect(await mediaProbe(page)).toMatchObject({
    previewAttached: true,
    liveTrackCount: 2,
  });

  await page.locator('a[href="/dashboard"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect
    .poll(async () => mediaProbe(page))
    .toMatchObject({
      previewAttached: false,
      trackCount: 2,
      liveTrackCount: 0,
    });
});
