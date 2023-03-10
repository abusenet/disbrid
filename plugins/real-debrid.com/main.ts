/**
 * A fetch handler for retrieving files through real-debrid.com.
 */

const BASE_URL = "https://api.real-debrid.com/rest/1.0";

type domain = string;
interface Host {
  id: string;
  name: string;
}

const HOSTERS = await fetch(`${BASE_URL}/hosts`)
  .then(response => response.json())
  .then((hosts: Record<domain, Host>) => Object.keys(hosts));

console.log(HOSTERS);

const exports = {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { host, searchParams } = url;
    const password = searchParams.get("password") || "";
    const apiKey = searchParams.get("api_key") ||
      Deno.env.get("DEBRID_API_KEY") || "";

    if (!HOSTERS.includes(host)) {
      return new Response(null, {
        status: 400,
      });
    }

    const body = new FormData();
    body.append("link", url.href);
    body.append("password", password);

    const response = await fetch(`${BASE_URL}/unrestrict/link`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body,
    });

    if (!response.ok) {
      return response;
    }

    const {
    //   id,
      // filename,
    //   mimeType,
    //   filesize,
    //   link, // Original link
    //   host,
    //   chunks,
    //   crc,
      download,
    //   streamable,
    } = await response.json();

    return fetch(download);
  }
}

export default exports;

if (import.meta.main) {
  Deno.serve((request: Request) => {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url") || "";

    return exports.fetch(new Request(url));
  });
}
