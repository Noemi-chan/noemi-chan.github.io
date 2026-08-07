// Refreshes a Spotify access token, tallies plays since the last run (via recently-played),
// and snapshots this month's top track + top artist (with self-tracked play counts) to music/snapshot.json.
// Requires env vars: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN

import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
  console.error("Missing required env vars: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN");
  process.exit(1);
}

const SNAPSHOT_PATH = path.join(process.cwd(), "music", "snapshot.json");

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function loadPreviousState() {
  try {
    const raw = await readFile(SNAPSHOT_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function getAccessToken() {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getTop(accessToken, type) {
  const response = await fetch(`https://api.spotify.com/v1/me/top/${type}?time_range=short_term&limit=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Top ${type} fetch failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.items?.[0] || null;
}

async function getRecentlyPlayed(accessToken, afterMs) {
  const params = new URLSearchParams({ limit: "50" });
  if (afterMs) params.set("after", String(afterMs));

  const response = await fetch(`https://api.spotify.com/v1/me/player/recently-played?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Recently-played fetch failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.items || [];
}

function tallyPlays(items, trackCounts, artistCounts) {
  let latestPlayedAtMs = null;

  for (const item of items) {
    const track = item.track;
    if (!track) continue;

    const playedAtMs = new Date(item.played_at).getTime();
    if (latestPlayedAtMs === null || playedAtMs > latestPlayedAtMs) latestPlayedAtMs = playedAtMs;

    const existingTrack = trackCounts[track.id];
    trackCounts[track.id] = {
      name: track.name,
      artist: track.artists?.map((a) => a.name).join(", ") || "",
      count: (existingTrack?.count || 0) + 1,
    };

    for (const artist of track.artists || []) {
      const existingArtist = artistCounts[artist.id];
      artistCounts[artist.id] = {
        name: artist.name,
        count: (existingArtist?.count || 0) + 1,
      };
    }
  }

  return latestPlayedAtMs;
}

function buildTrackSnapshot(track, trackCounts) {
  if (!track) return null;
  return {
    name: track.name,
    artist: track.artists?.map((a) => a.name).join(", ") || "",
    albumArt: track.album?.images?.[0]?.url || "",
    url: track.external_urls?.spotify || "",
    playCount: trackCounts[track.id]?.count || 0,
  };
}

function buildArtistSnapshot(artist, artistCounts) {
  if (!artist) return null;
  return {
    name: artist.name,
    image: artist.images?.[0]?.url || "",
    url: artist.external_urls?.spotify || "",
    genres: artist.genres || [],
    playCount: artistCounts[artist.id]?.count || 0,
  };
}

async function main() {
  const monthKey = currentMonthKey();
  const previous = await loadPreviousState();

  const sameMonth = previous?.monthKey === monthKey;
  const trackCounts = sameMonth ? previous.trackPlayCounts || {} : {};
  const artistCounts = sameMonth ? previous.artistPlayCounts || {} : {};
  const lastPolledAt = sameMonth ? previous.lastPolledAt || null : null;

  const accessToken = await getAccessToken();

  const [topTrack, topArtist, recentItems] = await Promise.all([
    getTop(accessToken, "tracks"),
    getTop(accessToken, "artists"),
    getRecentlyPlayed(accessToken, lastPolledAt),
  ]);

  const latestPlayedAtMs = tallyPlays(recentItems, trackCounts, artistCounts);
  const nextLastPolledAt = latestPlayedAtMs ?? lastPolledAt ?? Date.now();

  const snapshot = {
    updatedAt: new Date().toISOString(),
    monthKey,
    lastPolledAt: nextLastPolledAt,
    topTrack: buildTrackSnapshot(topTrack, trackCounts),
    topArtist: buildArtistSnapshot(topArtist, artistCounts),
    trackPlayCounts: trackCounts,
    artistPlayCounts: artistCounts,
  };

  await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + "\n");

  console.log("Wrote music/snapshot.json:", {
    updatedAt: snapshot.updatedAt,
    topTrack: snapshot.topTrack,
    topArtist: snapshot.topArtist,
    newPlaysTallied: recentItems.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
