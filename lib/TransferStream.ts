import { fetch, Progress, Rclone } from "../deps.ts";

// import DebridLink from "./debrid-link.fr/main.ts";
import RealDebrid from "./real-debrid.com/main.ts";

const encoder = new TextEncoder();
// Rclone remote to upload files to, default to current directory.
const TARGET = Deno.env.get("RCLONE_TARGET") || Deno.cwd();

const SMALL_TIME_UNITS = /\s[\d]+(ms|µs|ns)/g;

/**
 * Downloads an input through possible backends.
 */
async function download(input: string | URL | Request) {
  const request = new Request(input);
  const source = new URL(request.url);

  // Tries plugins until we get a successful response.
  let response = await RealDebrid.fetch(new Request(source));
  if (response.status === 400) { // Bad Request - not supported URL
    response = await Rclone.backend(
      "download",
      ":fshare:",
      `${source}`,
      {},
    );
  }
  if (response.status === 400) { // Bad Request - not supported URL
    source.searchParams.delete("password");
    response = await Rclone.cat(`${source}`);
  }

  return response;
}

/**
 * A ReadableStream with progress of streaming data from source to target.
 */
export class TransferStream extends ReadableStream {
  constructor({ url, signal }: Request) {
    const source = new URL(url);

    async function start(controller) { // When the stream starts
      const { ok, status, statusText, headers, body, url } = await download(
        source,
      );

      if (!ok) {
        controller.enqueue(
          encoder.encode(`\r**Error**: ${status} ${statusText}`),
        );
        return;
      }

      if (headers.get("Content-Type")?.includes("text/html")) {
        controller.enqueue(
          encoder.encode(`\r**Error**: Host did not return supported file`),
        );
        return;
      }

      let { pathname } = new URL(url);
      pathname = decodeURIComponent(pathname);
      const filename = pathname.substring(pathname.lastIndexOf("/") + 1);

      const fileSize = Number(headers.get("Content-Length"));

      //#region Progress
      function onProgress({
        completedh,
        done,
        etah,
        totalh,
        percent,
        rateh,
        timeh,
      }: Progress) {
        etah = etah.replace(SMALL_TIME_UNITS, ""); // We don't need high precision.
        timeh = timeh.replace(SMALL_TIME_UNITS, "");

        let message = "\f"; // Clears previous message.
        message +=
          `\r\nTransferred:    ${completedh} / ${totalh}, ${percent}%, ${rateh}/s`;
        if (!done) {
          message += `, ETA ${etah}`;
        }
        message += `\r\nElapsed time:   ${timeh}`;
        message += `\r\nTransferring:`;
        message += `\r\n* ${filename}: ${percent}% /${totalh}, ${rateh}/s`;
        if (!done) {
          message += `, ${etah}`;
        }

        controller.enqueue(encoder.encode(message));
      }
      //#endregion Progress

      const abortableStream = new TransformStream({
        start(controller) {
          signal.addEventListener("abort", () => {
            controller.terminate();
          });
        },
      });
      const progressStream = new Progress(fileSize, onProgress);

      // Calls Rclone's `fetch` directly instead of `rcat` since it expects `Deno.stdin`.
      fetch(`${TARGET}/${filename}`, {
        method: "PUT",
        // Hooks into the file stream and sends progress to reply stream.
        body: body!.pipeThrough(abortableStream).pipeThrough(progressStream),
      });
    }

    super({
      start,
    });
  }
}
