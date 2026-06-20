// AutoEmbed Provider for Nuvio
// autoembed.cc - TMDB-based embed with multiple quality options
// Hermes-compatible: no async/await

"use strict";

var PROVIDER_NAME = "AutoEmbed";

var BASES = [
  "https://autoembed.cc",
  "https://autoembed.to"
];

function buildUrl(base, mediaType, tmdbId, season, episode) {
  if (mediaType === "movie") {
    return base + "/embed/movie/" + tmdbId;
  } else {
    return base + "/embed/tv/" + tmdbId + "-" + season + "-" + episode;
  }
}

function fetchWithTimeout(url, opts, ms) {
  ms = ms || 12000;
  return new Promise(function(resolve, reject) {
    var t = setTimeout(function() { reject(new Error("timeout")); }, ms);
    fetch(url, opts || {})
      .then(function(r) { clearTimeout(t); resolve(r); })
      ["catch"](function(e) { clearTimeout(t); reject(e); });
  });
}

function tryBase(base, mediaType, tmdbId, season, episode) {
  var url = buildUrl(base, mediaType, tmdbId, season, episode);
  return fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": base + "/",
      "Accept": "text/html,application/xhtml+xml,*/*"
    }
  }).then(function(res) {
    if (!res.ok) return null;
    return res.text();
  }).then(function(html) {
    if (!html) return null;
    var streams = [];

    // autoembed often serves quality options in data attributes or script tags
    var qualityMap = { "4k": "4K", "1080": "1080p", "720": "720p", "480": "480p", "360": "360p" };
    var m3u8 = html.match(/https?:\/\/[^"'<>\s]+\.m3u8[^"'<>\s]*/g) || [];
    var mp4 = html.match(/https?:\/\/[^"'<>\s]+\.mp4[^"'<>\s]*/g) || [];

    m3u8.slice(0, 3).forEach(function(u) {
      var q = "Auto";
      Object.keys(qualityMap).forEach(function(k) { if (u.indexOf(k) > -1) q = qualityMap[k]; });
      streams.push({ name: PROVIDER_NAME, title: q + " HLS", url: u, quality: q, headers: { "Referer": url, "Origin": base } });
    });
    mp4.slice(0, 3).forEach(function(u) {
      var q = "720p";
      Object.keys(qualityMap).forEach(function(k) { if (u.indexOf(k) > -1) q = qualityMap[k]; });
      streams.push({ name: PROVIDER_NAME, title: q + " MP4", url: u, quality: q, headers: { "Referer": url } });
    });

    if (streams.length === 0) {
      streams.push({
        name: PROVIDER_NAME,
        title: "AutoEmbed",
        url: url,
        quality: "Auto",
        headers: { "Referer": base + "/" }
      });
    }
    return streams;
  })["catch"](function() { return null; });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return Promise.all(
    BASES.map(function(b) { return tryBase(b, mediaType, tmdbId, season, episode); })
  ).then(function(results) {
    var out = [];
    results.forEach(function(r) {
      if (r && Array.isArray(r)) r.forEach(function(s) { out.push(s); });
    });
    return out;
  });
}
