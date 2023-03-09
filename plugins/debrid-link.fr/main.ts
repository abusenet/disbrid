/**
 * A fetch handler for retrieving files through debrid-link.
 */

const BASE_URL = "https://debrid-link.com/api/v2";

const HOSTERS = [
  "1fichier.com",
  "anonfiles.com",
  "ddl.to",
  "katfile.org",
  "mega.nz",
  "rapidgator.net",
  "uptobox.com",
  "zippyshare.com",
];

const globalFetch = globalThis.fetch;

export async function fetch(
  input: string | Request | URL,
  init?: RequestInit,
): Promise<Response> {
  if (typeof input === "string") {
    input = new URL(input, import.meta.url);
  }

  if (input instanceof URL) {
    input = new Request(input);
  }

  input = new Request(input, init);

  const url = new URL(input.url);
  const { host, searchParams } = url;
  const password = searchParams.get("password") || "";
  const apiKey = searchParams.get("api_key") ||
    Deno.env.get("DEBRID_API_KEY") || "";

  if (!HOSTERS.includes(host)) {
    return new Response(null, {
      status: 400,
    });
  }

  const response = await globalFetch(`${BASE_URL}/downloader/add`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      password,
    }),
  });

  const { success, error, value } = await response.json();
  if (!success) {
    return new Response(`Can't fetch with error: ${error}`, {
      status: response.status,
      statusText: response.statusText,
    });
  }

  const {
    // id,
    // expired,
    // chunk,
    // host,
    // size,
    // created,
    // url,
    downloadUrl,
    // name
  } = value;

  console.log("fetching", downloadUrl);
 return fetch(downloadUrl);
}
