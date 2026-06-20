// SuperEmbed Provider for Nuvio
// Fetches streams from multiembed.mov / superembed.stream
// Hermes-compatible: no async/await

"use strict";

var PROVIDER_NAME = "SuperEmbed";

var BASES = [
  "https://multiembed.mov",
  "https://superembed.stream"
];

function buildUrl(base, mediaType, tmdbId, season, episode) {
  if (mediaType === "movie") {
    return base + "/directstream.php?video_id=" + tmdbId + "&tmdb=1";
  } else {
    return base + "/directstream.php?video_id=" + tmdbId + "&tmdb=1&s=" + season + "&e=" + episode;
  }
}

function fetchWithTimeout(url, options, timeout) {
  timeout = timeout || 10000;
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function() {
      reject(new Error("Timeout"));
    }, timeout);
    fetch(url, options || {}).then(function(res) {
      clearTimeout(timer);
      resolve(res);
    })["catch"](function(err) {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function tryBase(base, mediaType, tmdbId, season, episode) {
  var url = buildUrl(base, mediaType, tmdbId, season, episode);
  return fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": base + "/"
    },
    redirect: "follow"
  }, 12000).then(function(res) {
    var finalUrl = res.url || url;
    if (!res.ok) return null;
    return res.text().then(function(html) {
      var streams = [];
      var m3u8 = (html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g) || []);
      var mp4 = (html.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g) || []);
      m3u8.slice(0, 2).forEach(function(u) {
        streams.push({
          name: PROVIDER_NAME,
          title: "HLS",
          url: u,
          quality: "Auto",
          headers: { "Referer": base + "/", "Origin": base }
        });
      });
      mp4.slice(0, 2).forEach(function(u) {
        streams.push({
          name: PROVIDER_NAME,
          title: "MP4",
          url: u,
          quality: "720p",
          headers: { "Referer": base + "/" }
        });
      });
      if (streams.length === 0) {
        streams.push({
          name: PROVIDER_NAME,
          title: "SuperEmbed",
          url: finalUrl !== url ? finalUrl : url,
          quality: "Auto",
          headers: { "Referer": base + "/" }
        });
      }
      return streams;
    });
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
