import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(ROOT, "data", "videos.json");

const IG_USER_ID = process.env.IG_USER_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const SITE_BASE_URL = process.env.SITE_BASE_URL || "https://ashish200695.github.io/harami-manus";
const GRAPH_VERSION = "v21.0";
const MAX_RETRIES = 3;
const MAX_ATTEMPTS = 3;

function loadVideos() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function saveVideos(videos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(videos, null, 2));
}

function buildCaption(video) {
  const hashtags = (video.hashtags || []).join(" ");
  return [video.caption, "", hashtags].join("\n").slice(0, 2190);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function graphRequest(host, pathSegment, params) {
  const url = new URL(`https://${host}/${GRAPH_VERSION}/${pathSegment}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url, { method: "POST" });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error ? JSON.stringify(json.error) : `HTTP ${res.status}`);
  }
  return json;
}

async function waitUntilInstagramMediaReady(creationId) {
  for (let i = 0; i < 30; i++) {
    const url = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/${creationId}`);
    url.searchParams.set("fields", "status_code");
    url.searchParams.set("access_token", IG_ACCESS_TOKEN);
    const res = await fetch(url);
    const json = await res.json();
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") throw new Error("Media processing failed on Instagram's side");
    await sleep(3000);
  }
  throw new Error("Media was not ready for publishing after waiting");
}

async function postToInstagram(video) {
  const videoUrl = `${SITE_BASE_URL}/videos/${video.filename}`;
  const caption = buildCaption(video);
  const created = await graphRequest("graph.instagram.com", `${IG_USER_ID}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: "true",
    access_token: IG_ACCESS_TOKEN,
  });
  await waitUntilInstagramMediaReady(created.id);
  await graphRequest("graph.instagram.com", `${IG_USER_ID}/media_publish`, {
    creation_id: created.id,
    access_token: IG_ACCESS_TOKEN,
  });
}

async function postToFacebook(video) {
  const videoUrl = `${SITE_BASE_URL}/videos/${video.filename}`;
  const description = buildCaption(video);
  await graphRequest("graph.facebook.com", `${FB_PAGE_ID}/videos`, {
    file_url: videoUrl,
    description,
    access_token: FB_PAGE_ACCESS_TOKEN,
  });
}

async function runPlatform(platform) {
  const videos = loadVideos();
  const postedField = platform === "instagram" ? "igPostedAt" : "fbPostedAt";
  const attemptsField = platform === "instagram" ? "igPostAttempts" : "fbPostAttempts";

  const candidates = videos
    .filter((v) => !v[postedField] && (v[attemptsField] || 0) < MAX_RETRIES)
    .slice(0, MAX_ATTEMPTS);

  if (!candidates.length) {
    console.log(`[${platform}] No eligible videos found.`);
    return;
  }

  for (const video of candidates) {
    try {
      console.log(`[${platform}] Posting: ${video.id}`);
      if (platform === "instagram") {
        await postToInstagram(video);
      } else {
        await postToFacebook(video);
      }
      video[postedField] = new Date().toISOString();
      saveVideos(videos);
      console.log(`[${platform}] Posted successfully: ${video.id}`);
      return; // one post per run
    } catch (err) {
      console.error(`[${platform}] Failed to post ${video.id}:`, err.message);
      video[attemptsField] = (video[attemptsField] || 0) + 1;
      if (video[attemptsField] >= MAX_RETRIES) {
        video[`${platform === "instagram" ? "ig" : "fb"}PostFailedAt`] = new Date().toISOString();
      }
      saveVideos(videos);
    }
  }
  console.log(`[${platform}] No candidate could be posted this run.`);
}

async function main() {
  const platform = process.env.POST_PLATFORM;
  if (platform !== "instagram" && platform !== "facebook") {
    console.error('POST_PLATFORM must be "instagram" or "facebook".');
    process.exit(1);
  }

  if (platform === "instagram" && (!IG_USER_ID || !IG_ACCESS_TOKEN)) {
    console.error("Missing IG_USER_ID or IG_ACCESS_TOKEN. Skipping.");
    process.exit(0);
  }
  if (platform === "facebook" && (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN)) {
    console.error("Missing FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN. Skipping.");
    process.exit(0);
  }

  await runPlatform(platform);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
