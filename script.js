// video list
const videos = [
    "src/videos/nordscheleife_wippermann-f1.mp4",
    "src/videos/spa_raidillon-f1.mp4",
    //"src/videos/suzuka_130r.mp4",
    //"src/videos/"
    ];

const video = document.getElementById("intro-video");
const profile = document.getElementById("profile");
const favoriteAnimeImage = document.getElementById("favorite-anime-image");
const favoriteAnimeDescription = document.getElementById("favorite-anime-description");

const favoriteAnimeImages = [
  "src/imgs/3rd-anniversary-splash-art.jpeg",
  "src/imgs/4th-anniversary-splash-screen-art.jpeg",
  "src/imgs/7th-anniversary-key-visual.jpeg",
  "src/imgs/8th-anniversary-key-visual.jpeg",
  "src/imgs/9th-anniversary-key-visual.jpeg",
  "src/imgs/BanG-Dream-Our-Notes-art.jpeg",
  "src/imgs/Poppin-Party-anime-cover.jpeg"
];

// Cache frequently used elements
const statusEl = document.getElementById("discord-status");
const statusRing = document.getElementById('status-ring');
let spotifySection = null;
let artEl = null;
let trackEl = null;
let artistEl = null;
let progressEl = null;
let currentTimeEl = null;
let durationEl = null;
let activitySection = null;
let activityIcon = null;
let activityName = null;
let activityDetails = null;
let activityLastDetail = null;
let activityMetaLine = null;
let activityTime = null;
let activityIconRequestId = 0;
let currentActivityIconKey = '';
let presenceWidgets = null;

function ensurePresenceWidgets() {
  if (presenceWidgets) return presenceWidgets;

  const profileCard = document.querySelector('.profile-card-content');
  const about = document.querySelector('.about');
  if (!profileCard || !about) return null;

  presenceWidgets = document.createElement('div');
  presenceWidgets.className = 'presence-widgets';
  profileCard.insertBefore(presenceWidgets, about);
  return presenceWidgets;
}

function syncPresenceWidgets() {
  const widgets = ensurePresenceWidgets();
  if (!widgets) return;

  widgets.replaceChildren();

  if (activitySection) {
    widgets.appendChild(activitySection);
  }

  if (spotifySection) {
    widgets.appendChild(spotifySection);
  }

  widgets.classList.toggle('has-single', widgets.childElementCount === 1);
  widgets.classList.toggle('has-multiple', widgets.childElementCount > 1);
}

// chooses random video to play (with fallbacks)
if (videos.length === 0) {
  // no videos available — hide video element and show profile
  video.style.display = "none";
  profile.classList.remove("hidden");
  setTimeout(() => profile.classList.add("show"), 50);
} else {
  const randomIndex = Math.floor(Math.random() * videos.length);
  video.src = videos[randomIndex];

  let endHandled = false;

  function showProfile() {
    if (endHandled) return;
    endHandled = true;
    video.pause();
    video.classList.add("blur");
    profile.classList.remove("hidden");
    setTimeout(() => profile.classList.add("show"), 50);
  }

  // show profile when video ends
  video.addEventListener("ended", showProfile);

  // if video fails to load or play, fallback to showing the profile
  video.addEventListener("error", showProfile);

  // If playback stalls at the end (some encodings/browsers), detect near-end and force the fallback
  video.addEventListener('timeupdate', () => {
    const dur = video.duration;
    const cur = video.currentTime;
    if (!isNaN(dur) && dur > 0 && dur - cur <= 0.25) {
      showProfile();
    }
  });

  // safety timeout: if nothing happens (autoplay blocked or long load), show profile
  const fallbackTimeout = setTimeout(() => {
    if (!profile.classList.contains("show")) {
      showProfile();
    }
  }, 8000);

  // clear fallback when profile shows normally
  const observer = new MutationObserver(() => {
    if (profile.classList.contains("show")) {
      clearTimeout(fallbackTimeout);
      observer.disconnect();
    }
  });
  observer.observe(profile, { attributes: true, attributeFilter: ["class"] });
}

// Helper function to format milliseconds to MM:SS
function formatTime(ms) {
  if (isNaN(ms)) return '0:00';
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function setFavoriteAnimeImage() {
  if (!favoriteAnimeImage || favoriteAnimeImages.length === 0) return;
  const randomIndex = Math.floor(Math.random() * favoriteAnimeImages.length);
  favoriteAnimeImage.src = favoriteAnimeImages[randomIndex];
}

function maybeSetBangDreamDescription() {
  if (!favoriteAnimeDescription) return;
  if (Math.floor(Math.random() * 100) !== 0) return;

  favoriteAnimeDescription.textContent = Array(39).fill("BanG Dream!").join(" ");
}

function startAnimeImageRotation(imageElement, imageList) {
  if (!imageElement || imageList.length === 0) return;

  let imageIndex = 0;
  const applyImage = () => {
    const nextImage = imageList[imageIndex];
    imageIndex = (imageIndex + 1) % imageList.length;

    imageElement.classList.add("is-switching");

    window.setTimeout(() => {
      imageElement.src = nextImage;
    }, 170);
  };

  imageElement.addEventListener("load", () => {
    imageElement.classList.remove("is-switching");
  });

  applyImage();

  if (imageList.length > 1) {
    setInterval(applyImage, 15000);
  }
}

// Simple HTML-escape to avoid inserting raw HTML from presence strings
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const activityIconCache = new Map();
const applicationIconCache = new Map();

function getActivityIconKey(activity) {
  const assetKey = activity?.assets?.large_image || activity?.assets?.small_image || '';
  return [activity?.application_id || '', activity?.name || '', assetKey].join('|');
}

function getActivityIconCandidates(activity) {
  const assetKey = activity?.assets?.large_image || activity?.assets?.small_image;
  const candidates = [];

  if (assetKey) {
    if (assetKey.startsWith('http')) {
      candidates.push(assetKey);
    } else if (assetKey.startsWith('mp:')) {
      candidates.push(`https://media.discordapp.net/${assetKey.slice(3)}`);
    } else if (activity.application_id) {
      candidates.push(
        `https://cdn.discordapp.com/app-assets/${activity.application_id}/${assetKey}`,
        `https://cdn.discordapp.com/app-assets/${activity.application_id}/${assetKey}.webp`,
        `https://cdn.discordapp.com/app-assets/${activity.application_id}/${assetKey}.png`,
        `https://cdn.discordapp.com/app-assets/${activity.application_id}/${assetKey}.jpg`
      );
    }
  }

  return candidates;
}

async function getApplicationIconUrl(applicationId) {
  if (!applicationId) return '';
  if (applicationIconCache.has(applicationId)) return applicationIconCache.get(applicationId);

  try {
    const response = await fetch(`https://discord.com/api/v10/oauth2/applications/${applicationId}/rpc`);
    if (!response.ok) throw new Error(`Discord app lookup failed: ${response.status}`);

    const application = await response.json();
    const iconHash = application?.icon;
    const iconUrl = iconHash
      ? `https://cdn.discordapp.com/app-icons/${applicationId}/${iconHash}.${iconHash.startsWith('a_') ? 'gif' : 'png'}`
      : '';

    applicationIconCache.set(applicationId, iconUrl);
    return iconUrl;
  } catch (error) {
    console.warn('Discord app icon lookup failed', error);
    applicationIconCache.set(applicationId, '');
    return '';
  }
}

function testImageUrl(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(url);
    image.onerror = () => resolve('');
    image.src = url;
  });
}

async function resolveActivityIcon(activity) {
  const iconKey = getActivityIconKey(activity);
  if (activityIconCache.has(iconKey)) return activityIconCache.get(iconKey);

  const candidates = getActivityIconCandidates(activity);

  for (const candidate of candidates) {
    const resolvedUrl = await testImageUrl(candidate);
    if (resolvedUrl) {
      activityIconCache.set(iconKey, resolvedUrl);
      return resolvedUrl;
    }
  }

  const applicationIconUrl = await getApplicationIconUrl(activity?.application_id);
  if (applicationIconUrl) {
    const resolvedUrl = await testImageUrl(applicationIconUrl);
    if (resolvedUrl) {
      activityIconCache.set(iconKey, resolvedUrl);
      return resolvedUrl;
    }
  }

  activityIconCache.set(iconKey, '');
  return '';
}

function formatActivityElapsed(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function updateActivityTime(activity) {
  if (!activityTime || !activity?.timestamps?.start) {
    if (activityTime) {
      activityTime.textContent = '';
      activityTime.hidden = true;
    }
    if (activityMetaLine) {
      const hasDetail = activityLastDetail && activityLastDetail.textContent && !activityLastDetail.hidden;
      activityMetaLine.hidden = !hasDetail;
    }
    return;
  }

  const elapsed = Date.now() - activity.timestamps.start;
  activityTime.textContent = `${formatActivityElapsed(elapsed)} elapsed`;
  activityTime.hidden = false;
  if (activityMetaLine) activityMetaLine.hidden = false;
}

const DISCORD_ID = "297264127888457729";
let spotifyUpdateInterval = null;
let currentPresence = null;

function updateSpotifyProgress() {
  if (!currentPresence || !currentPresence.listening_to_spotify || !currentPresence.spotify || !progressEl) return;

  if (currentPresence.spotify.timestamps) {
    const now = Date.now();
    const startTime = currentPresence.spotify.timestamps.start;
    const endTime = currentPresence.spotify.timestamps.end;
    
    const elapsed = now - startTime;
    const total = endTime - startTime;
    const percent = (elapsed / total) * 100;
    const p = Math.min(Math.max(percent, 0), 100);
    progressEl.value = p;
    currentTimeEl.textContent = formatTime(elapsed);
    durationEl.textContent = formatTime(total);

    // paint played portion green and remaining portion grey on the input itself
    // use explicit color stops so browsers render correctly
    progressEl.style.background = `linear-gradient(90deg, #1DB954 0%, #1DB954 ${p}%, rgba(255,255,255,0.18) ${p}%, rgba(255,255,255,0.18) 100%)`;
  }
}

function fetchDiscordPresence() {
  fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`)
    .then(res => {
      if (!res.ok) throw new Error('Lanyard request failed: ' + res.status);
      return res.json();
    })
    .then(data => {
      const presence = data.data || {};
      currentPresence = presence;

      // Status
      const statusMap = {
        online: "I am currently online. Feel free to text me!",
        idle: "I am doing something else atm. Brb!",
        dnd: "I am busy atm. Response may be delayed.",
        offline: "I am offline. Most likely sleeping... 💤"
      };
      statusEl.textContent = statusMap[presence.discord_status] || statusMap.offline;

      // Update radial status ring color around avatar
      const statusColorMap = {
        online: '#43b581',
        idle: '#faa61a',
        dnd: '#f04747',
        offline: '#747f8d'
      };
      const s = (presence.discord_status || 'offline').toLowerCase();
      const color = statusColorMap[s] || '#747f8d';
      statusRing.style.borderColor = color;
      statusRing.classList.toggle('glow', s === 'online' || s === 'dnd' || s === 'idle');

      // Find non-Spotify activities
      let gameActivity = null;
      if (presence.activities && presence.activities.length > 0) {
        gameActivity = presence.activities.find(a => a.type === 0) ||
                       presence.activities.find(a => a.name !== 'Spotify' && a.type !== 4 && a.id !== 'custom');
      }

      // Activity widget
      if (gameActivity) {
        if (!activitySection) {
          activitySection = document.createElement('div');
          activitySection.id = 'activity-section';
          activitySection.className = 'activity-section activity-box';
          activitySection.innerHTML = `
            <div class="section-label activity-box-label">Current activity:</div>
            <div class="activity-row">
              <img id="activity-icon" class="activity-icon" alt="" aria-hidden="true">
              <div class="activity-info">
                <p id="activity-name" class="activity-name"></p>
                <p id="activity-details" class="activity-details"></p>
                <div id="activity-meta-line" class="activity-meta-line">
                  <span id="activity-last-detail" class="activity-last-detail"></span>
                  <span id="activity-time" class="activity-time"></span>
                </div>
              </div>
            </div>
          `;
          ensurePresenceWidgets();
          activityIcon = activitySection.querySelector('#activity-icon');
          activityName = activitySection.querySelector('#activity-name');
          activityDetails = activitySection.querySelector('#activity-details');
          activityLastDetail = activitySection.querySelector('#activity-last-detail');
          activityMetaLine = activitySection.querySelector('#activity-meta-line');
          activityTime = activitySection.querySelector('#activity-time');
          activityIcon.hidden = true;
          activitySection.classList.add('activity-section--no-icon');
          activityIcon.addEventListener('error', () => {
            activityIcon.hidden = true;
            activityIcon.removeAttribute('src');
            activitySection.classList.add('activity-section--no-icon');
          });
        }
        activityName.textContent = gameActivity.name || '';
        const detailParts = [];
        if (gameActivity.details) detailParts.push(gameActivity.details);
        if (gameActivity.state) detailParts.push(gameActivity.state);
        const hasInlineTimer = detailParts.length >= 2;
        activityDetails.innerHTML = detailParts.slice(0, hasInlineTimer ? -1 : undefined).map(escapeHtml).join('<br>');
        activityDetails.hidden = detailParts.length === 0 || (hasInlineTimer && detailParts.length === 1);
        activityLastDetail.textContent = hasInlineTimer ? detailParts[detailParts.length - 1] : '';
        activityLastDetail.hidden = !hasInlineTimer;
        updateActivityTime(gameActivity);

        const nextActivityIconKey = getActivityIconKey(gameActivity);
        if (nextActivityIconKey !== currentActivityIconKey) {
          currentActivityIconKey = nextActivityIconKey;
          const iconRequestId = ++activityIconRequestId;
          activityIcon.hidden = true;
          activityIcon.removeAttribute('src');
          activitySection.classList.add('activity-section--no-icon');

          resolveActivityIcon(gameActivity).then((activityIconUrl) => {
            if (iconRequestId === activityIconRequestId && activitySection && activityIcon) {
              if (activityIconUrl) {
                activitySection.classList.remove('activity-section--no-icon');
                activityIcon.src = activityIconUrl;
                activityIcon.hidden = false;
              } else {
                activityIcon.removeAttribute('src');
                activityIcon.hidden = true;
                activitySection.classList.add('activity-section--no-icon');
              }
            }
          });
        }
        syncPresenceWidgets();
      } else {
        if (activitySection) {
          activityIconRequestId++;
          currentActivityIconKey = '';
          activitySection.remove();
          activitySection = null;
          activityIcon = null;
          activityName = null;
          activityDetails = null;
          activityLastDetail = null;
          activityMetaLine = null;
          activityTime = null;
          syncPresenceWidgets();
        }
      }

      // Spotify section
      if (presence.listening_to_spotify && presence.spotify) {
        if (!spotifySection) {
          spotifySection = document.createElement('div');
          spotifySection.id = 'spotify-section';
          spotifySection.className = 'spotify-section';
          spotifySection.innerHTML = `
            <div class="section-label spotify-label">
              <img class="spotify-logo" src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" alt="Spotify" aria-hidden="true">
              <span class="section-label-text">Spotify:</span>
            </div>
            <div class="spotify-row">
              <img id="spotify-art" class="spotify-art" alt="Album cover">
              <div class="spotify-info">
                <p id="spotify-track" class="spotify-track"></p>
                <p id="spotify-artist" class="spotify-artist"></p>
                <div class="spotify-progress-container">
                  <span id="spotify-current-time" class="spotify-time">0:00</span>
                  <input type="range" id="spotify-progress" class="spotify-progress" min="0" max="100" value="0">
                  <span id="spotify-duration" class="spotify-time">0:00</span>
                </div>
              </div>
            </div>
          `;
          ensurePresenceWidgets();
          artEl = spotifySection.querySelector('#spotify-art');
          trackEl = spotifySection.querySelector('#spotify-track');
          artistEl = spotifySection.querySelector('#spotify-artist');
          progressEl = spotifySection.querySelector('#spotify-progress');
          currentTimeEl = spotifySection.querySelector('#spotify-current-time');
          durationEl = spotifySection.querySelector('#spotify-duration');
        }
        artEl.src = presence.spotify.album_art_url || `https://i.scdn.co/image/${presence.spotify.album_art_hash}`;
        trackEl.textContent = presence.spotify.song || 'Unknown Track';
        artistEl.textContent = presence.spotify.artist || 'Unknown Artist';

        updateSpotifyProgress();
        if (!spotifyUpdateInterval) {
          spotifyUpdateInterval = setInterval(updateSpotifyProgress, 1000);
        }
        progressEl.disabled = true;
        syncPresenceWidgets();
      } else {
        if (spotifySection) {
          spotifySection.remove();
          spotifySection = null;
          artEl = null;
          trackEl = null;
          artistEl = null;
          progressEl = null;
          currentTimeEl = null;
          durationEl = null;
          if (spotifyUpdateInterval) {
            clearInterval(spotifyUpdateInterval);
            spotifyUpdateInterval = null;
          }
          syncPresenceWidgets();
        }
      }
    })
    .catch((err) => {
      console.warn('Lanyard fetch failed', err);
      statusEl.textContent = "Offline";
    });
}

function formatPlayCount(count) {
  if (!count) return '';
  return count === 1 ? 'Played 1 time this month' : `Played ${count} times this month`;
}

function renderTopMusicCard({ label, art, artClass, name, sub, url, playCount }) {
  const safeName = escapeHtml(name);
  const safeSub = sub ? escapeHtml(sub) : '';
  const playCountLabel = formatPlayCount(playCount);
  const artTag = art
    ? `<img class="top-music-art ${artClass}" src="${art}" alt="" aria-hidden="true">`
    : '';

  return `
    <a class="top-music-card" href="${url || '#'}" target="_blank" rel="noopener noreferrer">
      ${artTag}
      <div class="top-music-info">
        <p class="top-music-label">${label}</p>
        <p class="top-music-name">${safeName}</p>
        ${safeSub ? `<p class="top-music-sub">${safeSub}</p>` : ''}
        ${playCountLabel ? `<p class="top-music-count">${playCountLabel}</p>` : ''}
      </div>
    </a>
  `;
}

function loadTopMusic() {
  const container = document.getElementById('top-music');
  if (!container) return;

  fetch('music/snapshot.json', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('music/snapshot.json request failed: ' + res.status);
      return res.json();
    })
    .then((data) => {
      const cards = [];

      if (data.topTrack) {
        cards.push(renderTopMusicCard({
          label: 'Top track this month',
          art: data.topTrack.albumArt,
          artClass: '',
          name: data.topTrack.name,
          sub: data.topTrack.artist,
          url: data.topTrack.url,
          playCount: data.topTrack.playCount,
        }));
      }

      if (data.topArtist) {
        cards.push(renderTopMusicCard({
          label: 'Top artist this month',
          art: data.topArtist.image,
          artClass: 'top-music-artist-art',
          name: data.topArtist.name,
          sub: (data.topArtist.genres || []).slice(0, 2).join(', '),
          url: data.topArtist.url,
          playCount: data.topArtist.playCount,
        }));
      }

      if (cards.length === 0) {
        container.innerHTML = '<p class="section-note">No listening data yet.</p>';
        return;
      }

      const updatedAt = data.updatedAt ? new Date(data.updatedAt) : null;
      const updatedLine = updatedAt
        ? `<p class="top-music-updated">Updated ${updatedAt.toLocaleDateString()}</p>`
        : '';

      container.innerHTML = cards.join('') + updatedLine;
    })
    .catch((err) => {
      console.warn('Top music fetch failed', err);
      container.innerHTML = '<p class="section-note">Couldn\'t load top music right now.</p>';
    });
}

document.addEventListener("DOMContentLoaded", () => {
  setFavoriteAnimeImage();
  maybeSetBangDreamDescription();
  loadTopMusic();
  const accordionSections = document.querySelectorAll("[data-accordion], .PCstats");

  accordionSections.forEach((section) => {
    const header = section.querySelector(".pc-header, .section-header");
    const content = section.querySelector(".pc-content, .section-content");
    if (!header || !content) return;

    header.addEventListener("click", () => {
      const isActive = section.classList.toggle("active");
      header.setAttribute("aria-expanded", String(isActive));
    });
  });

});

const messages = [
  "Attempting to survive robotics engineering.",
  "Deluding my dream as a pilot.",
  "Most probably listening to music.",
  "Imagining countless projects I will never start or finish.",
  "Adding animes to my to-watch list knowing full well I will never watch",
  "Probably finding loads of new anime pfps",
  "Glazing BanG Dream!",
  "Procrastinating on a lot of things.",
  "This is just a filler message!!!",
  "Doing something random."
];

const currentText = document.getElementById("current-text");
let currentMessageIndex = 0;
let remainingMessageIndices = [];

function shuffleIndices(indices) {
  const shuffled = [...indices];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }

  return shuffled;
}

function refillMessageQueue() {
  const nextPool = messages
    .map((_, index) => index)
    .filter((index) => index !== 0);

  remainingMessageIndices = shuffleIndices(nextPool);
}

function getNextMessageIndex() {
  if (messages.length <= 1) return 0;
  if (remainingMessageIndices.length === 0) refillMessageQueue();
  return remainingMessageIndices.shift();
}

function rotateMessage() {
  if (!currentText) return;

  // fade out
  currentText.style.opacity = 0;

  setTimeout(() => {
    currentMessageIndex = getNextMessageIndex();
    currentText.textContent = messages[currentMessageIndex];
    currentText.style.opacity = 1;
  }, 300);
}
// initial + loop
if (currentText) {
  currentText.textContent = messages[0];
  currentText.style.opacity = 1;
}
setInterval(rotateMessage, 30000);

// Initial fetch
fetchDiscordPresence();

// Refresh presence every 2 seconds (reduced from 1 for performance)
setInterval(fetchDiscordPresence, 2000);
