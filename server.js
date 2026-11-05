// PDF Marginalia: local server for annotating PDFs held in GitHub repositories.
// Run `node server.js`, open http://localhost:8787, paste a GitHub blob URL.
// Auth: $GITHUB_TOKEN / $GH_TOKEN, falling back to `gh auth token`.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = path.join(__dirname, "comments");
const BLOB_RE = /github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)(?:[?#].*)?$/;
const MAX_QUOTE = 300;
let tokenCache = null;

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function getToken() {
  if (tokenCache) return tokenCache;
  let token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    try { token = execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim(); }
    catch { throw new ApiError(401, "No GitHub token: set GITHUB_TOKEN or run `gh auth login`."); }
  }
  return (tokenCache = token);
}

function parseBlob(url) {
  const m = BLOB_RE.exec(url || "");
  if (!m) throw new ApiError(400, "Expected a URL like https://github.com/owner/repo/blob/branch/path/file.pdf");
  return { owner: m[1], repo: m[2], ref: decodeURIComponent(m[3]), path: decodeURIComponent(m[4]) };
}

async function github(method, url, body, raw = false) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json",
      "User-Agent": "pdf-marginalia",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, `GitHub said ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

async function fetchPdf(url) {
  const { owner, repo, ref, path: p } = parseBlob(url);
  const encoded = p.split("/").map(encodeURIComponent).join("/");
  const res = await github("GET", `https://api.github.com/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(ref)}`, null, true);
  return Buffer.from(await res.arrayBuffer());
}

function commentsFile(url) {
  const { owner, repo, ref, path: p } = parseBlob(url);
  const digest = crypto.createHash("sha1").update(`${owner}/${repo}/${ref}/${p}`).digest("hex").slice(0, 10);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return path.join(DATA_DIR, `${owner}__${repo}__${digest}.json`);
}

function loadState(url) {
  const file = commentsFile(url);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { comments: [], issue_url: null };
}

function saveState(url, state) {
  const file = commentsFile(url);
  fs.writeFileSync(file + ".tmp", JSON.stringify(state, null, 2));
  fs.renameSync(file + ".tmp", file);
}

function describe(c) {
  return `Page ${c.page}, ${c.start === c.end ? `line ${c.start}` : `lines ${c.start}-${c.end}`}`;
}

function buildIssue(url, comments) {
  const { path: p } = parseBlob(url);
  const ordered = [...comments].sort((a, b) => a.page - b.page || a.start - b.start);
  const parts = [
    `Review comments on [\`${p}\`](${url}) (${ordered.length} in total).`,
    "Line numbers are counted per page, top to bottom, as shown in the annotator.",
    "",
  ];
  for (const c of ordered) {
    parts.push(`### ${describe(c)}`);
    const quote = (c.quote || "").split(/\s+/).join(" ").slice(0, MAX_QUOTE);
    if (quote) parts.push(`> ${quote}`);
    parts.push("", c.text.trim(), "");
  }
  return { title: `PDF review: ${p}`, body: parts.join("\n") };
}

async function submit(url, state) {
  const comments = (state.comments || []).filter((c) => (c.text || "").trim());
  if (!comments.length) throw new ApiError(400, "No comments to submit.");
  const { owner, repo } = parseBlob(url);
  const res = await github("POST", `https://api.github.com/repos/${owner}/${repo}/issues`, buildIssue(url, comments));
  state.issue_url = (await res.json()).html_url;
  saveState(url, state);
  return state.issue_url;
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString() || "{}") : {}));
  });
}

http.createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, "http://localhost");
  const url = searchParams.get("url") || "";
  const send = (status, body, type = "application/json") => {
    res.writeHead(status, { "Content-Type": type });
    res.end(type === "application/json" ? JSON.stringify(body) : body);
  };
  try {
    if (req.method === "GET" && pathname === "/") send(200, fs.readFileSync(path.join(__dirname, "index.html")), "text/html; charset=utf-8");
    else if (req.method === "GET" && pathname === "/api/pdf") send(200, await fetchPdf(url), "application/pdf");
    else if (req.method === "GET" && pathname === "/api/comments") send(200, loadState(url));
    else if (req.method === "POST" && pathname === "/api/comments") { saveState(url, await readBody(req)); send(200, { ok: true }); }
    else if (req.method === "POST" && pathname === "/api/submit") send(200, { issue_url: await submit(url, await readBody(req)) });
    else throw new ApiError(404, "Not found");
  } catch (err) {
    send(err.status || 500, { error: err.message });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Open http://localhost:${PORT}`));
