// Free Cloudflare Worker that forwards GET /resource/... to api.data.gov.in.
// Use it when api.data.gov.in refuses connections from your server or network.
// Deploy: dash.cloudflare.com > Workers & Pages > Create > paste this > Deploy.
// Then set DATA_GOV_IN_BASE_URL=https://<your-worker>.workers.dev in backend/.env.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" || !url.pathname.startsWith("/resource/")) {
      return new Response("Not found", { status: 404 });
    }
    return fetch("https://api.data.gov.in" + url.pathname + url.search, {
      headers: { Accept: "application/json" },
    });
  },
};
