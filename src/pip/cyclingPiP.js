/**
 * cyclingPiP.js — Shared cycling state for PiP player
 *
 * Plain JS module consumed by both DesktopPiP and MobilePiP.
 * Manages the ordered channel list, current index, and notifies
 * listeners when the active stream changes.
 */

let channels = [];
let currentIndex = 0;
let parentHost = '';
let onChangeCallbacks = [];

// ---- Setup ----

export function initCycling(channelList, host) {
  channels = channelList.filter(c => c.channel.trim());
  parentHost = host;
  currentIndex = 0;
  notifyChange();
}

export function destroyCycling() {
  channels = [];
  currentIndex = 0;
  onChangeCallbacks = [];
}

// ---- Navigation ----

export function nextStream() {
  if (channels.length === 0) return;
  currentIndex = (currentIndex + 1) % channels.length;
  notifyChange();
}

export function prevStream() {
  if (channels.length === 0) return;
  currentIndex = (currentIndex - 1 + channels.length) % channels.length;
  notifyChange();
}

// ---- Getters ----

export function getCurrentChannel() {
  return channels[currentIndex] || null;
}

export function getCurrentIndex() {
  return currentIndex;
}

export function getChannelCount() {
  return channels.length;
}

export function getParentHost() {
  return parentHost;
}

export function buildCurrentStreamUrl() {
  const ch = getCurrentChannel();
  if (!ch) return '';
  return buildStreamUrl(ch.channel);
}

export function buildStreamUrl(channelName) {
  const url = new URL('https://player.twitch.tv/');
  url.searchParams.set('channel', channelName);
  url.searchParams.set('parent', parentHost);
  url.searchParams.set('muted', 'false');
  url.searchParams.set('autoplay', 'true');
  return url.toString();
}

// ---- Live updates (when user changes streams while PiP is open) ----

export function updateChannels(channelList) {
  const newChannels = channelList.filter(c => c.channel.trim());
  const currentName = channels[currentIndex]?.channel;
  channels = newChannels;

  if (channels.length === 0) {
    currentIndex = 0;
    notifyChange();
    return;
  }

  // Try to stay on the same channel
  if (currentName) {
    const found = channels.findIndex(c => c.channel === currentName);
    currentIndex = found >= 0 ? found : Math.min(currentIndex, channels.length - 1);
  } else {
    currentIndex = 0;
  }

  notifyChange();
}

// ---- Observer ----

export function onChange(callback) {
  onChangeCallbacks.push(callback);
  // Return unsubscribe function
  return () => {
    onChangeCallbacks = onChangeCallbacks.filter(cb => cb !== callback);
  };
}

function notifyChange() {
  const state = {
    channel: getCurrentChannel(),
    index: currentIndex,
    total: channels.length,
    url: buildCurrentStreamUrl(),
  };
  onChangeCallbacks.forEach(cb => cb(state));
}
