import type { CmaClient } from '@datocms/cli-utils';

/**
 * Mux encodes video asynchronously: an upload's `mux_playback_id` is `null` the
 * moment the import finishes and appears a few seconds later. Asserting on it
 * straight away is a coin flip — measured at roughly five seconds, which is
 * exactly the range where a suite passes on one machine and fails on another.
 *
 * Returns the upload as last read, so the caller still asserts and still gets a
 * real failure if the id never arrives.
 */
export async function waitForMuxPlaybackId(
  client: CmaClient.Client,
  uploadId: string,
  timeoutMs = 60_000,
) {
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const upload = await client.uploads.find(uploadId);

    if (upload.mux_playback_id || Date.now() > deadline) {
      return upload;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
