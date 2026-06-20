// EmbedSu Provider for Nuvio
// embed.su - supports multi-quality streams via TMDB IDs
// Hermes-compatible: no async/await

"use strict";

var PROVIDER_NAME = "EmbedSu";
var BASE = "https://embed.su";

function buildUrl(mediaType, tmdbId, season, episode) {
  if (mediaType === "movie") {
    return BASE + "/embed/movie/" + tmdbId;
  } else {
    return BASE + "/embed/tv/" + tmdbId + "/" + season + "/" + episode;
  }
}

function fetchWithTimeout(url, opts, ms) {
  ms = ms || 10000;
  return new Promise(function(resolve, reject) {
    var t = setTimeout(function() { reject(new Error("timeout")); }, ms);
    fetch(url, opts || {}).then(function(r) { clearTimeout(t); resolve(r); })["catch"](function(e) { clearTimeout(t); reject(e); });
  });
}

function extractJsonConfig(html) {
  // embed.su typically embeds a JSON config with stream data
  try {
    var match = html.match(/atob\(['"]([A-Za-z0-9+/=]+)['"]\)/);
    if (match) {
      var decoded = atob(match[1]);
      return JSON.parse(decoded);
    }
  } catch (e) {}
  return null;
}

function getStreams(tmdbId, mediaType, season, episode) {
  var url = buildUrl(mediaType, tmdbId, season, episode);
  var referer = BASE + "/";

  return fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": referer
    }
  }, 12000).then(function(res) {
    if (!res.ok) return [];
    return res.text();
  }).then(function(html) {
    if (!html) return [];
    var streams = [];

    // Try to parse embedded JSON config
    var config = extractJsonConfig(html);
    if (config && config.sources) {
      config.sources.forEach(function(src) {
        if (src.file || src.src) {
          streams.push({
            name: PROVIDER_NAME,
            title: src.label || "Stream",
            url: src.file || src.src,
            quality: src.label || "Auto",
            headers: { "Referer": url, "Origin": BASE }
          });
        }
      });
    }

    // Fallback: regex for m3u8/mp4
    if (streams.length === 0) {
      var m3u8 = html.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/g) || [];
      var mp4 = html.match(/https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*/g) || [];
      m3u8.slice(0, 3).forEach(function(u) {
        streams.push({ name: PROVIDER_NAME, title: "HLS", url: u, quality: "Auto", headers: { "Referer": url } });
      });
      mp4.slice(0, 2).forEach(function(u) {
        streams.push({ name: PROVIDER_NAME, title: "MP4", url: u, quality: "720p", headers: { "Referer": url } });
      });
    }

    // Last resort: embed page itself
    if (streams.length === 0) {
      streams.push({
        name: PROVIDER_NAME,
        title: "EmbedSu",
        url: url,
        quality: "Auto",
        headers: { "Referer": referer }
      });
    }

    return streams;
  })["catch"](function() { return []; });
}
