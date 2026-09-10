import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(ROOT, "data", "videos.json");
const VIDEOS_DIR = path.join(ROOT, "videos");

// Local video bank on this Mac — pass a different path as argv[2] if it ever moves.
const SOURCE_DIR = process.argv[2] || "/Users/macintoshhd/Desktop/Kahaniwaala 2/memes/reels";

const BASE_HASHTAGS = ["#Anime", "#AnimeNews", "#AnimeClips", "#Otaku", "#AnimeTok", "#AnimeEdit"];
const ONE_PIECE_HASHTAGS = ["#OnePiece", "#ONEPIECE", "#ワンピース", "#OnePieceAnime", "#Luffy"];

function loadVideos() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveVideos(videos) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(videos, null, 2));
}

// Filenames look like "Saul Shares - Dc3yvC8M7c1.mp4" — pull out just the shortcode so our
// own hosted URLs don't expose the source account name, and are URL-safe (no spaces).
function extractId(filename) {
  const m = filename.match(/-\s*([A-Za-z0-9_-]+)\.mp4$/i);
  return m ? m[1] : filename.replace(/\.mp4$/i, "").replace(/[^A-Za-z0-9_-]/g, "");
}

function buildHashtags(caption) {
  const tags = [...BASE_HASHTAGS];
  if (/one\s*piece|ワンピース/i.test(caption)) {
    tags.push(...ONE_PIECE_HASHTAGS);
  }
  const seen = new Set();
  return tags.filter((t) => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source folder not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  const videos = loadVideos();
  const existingIds = new Set(videos.map((v) => v.id));

  fs.mkdirSync(VIDEOS_DIR, { recursive: true });

  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.toLowerCase().endsWith(".mp4"));
  let added = 0;

  for (const mp4Name of files) {
    const id = extractId(mp4Name);
    if (existingIds.has(id)) continue;

    const txtName = mp4Name.replace(/\.mp4$/i, ".txt");
    const mp4Path = path.join(SOURCE_DIR, mp4Name);
    const txtPath = path.join(SOURCE_DIR, txtName);

    const caption = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, "utf-8").trim() : "";
    const hashtags = buildHashtags(caption);

    fs.copyFileSync(mp4Path, path.join(VIDEOS_DIR, `${id}.mp4`));

    videos.push({
      id,
      filename: `${id}.mp4`,
      caption,
      hashtags,
      addedAt: new Date().toISOString(),
      igPostedAt: null,
      igPostAttempts: 0,
      fbPostedAt: null,
      fbPostAttempts: 0,
    });
    existingIds.add(id);
    added++;
  }

  saveVideos(videos);
  console.log(`Synced ${added} new video(s). Total tracked: ${videos.length}.`);
}

main();
