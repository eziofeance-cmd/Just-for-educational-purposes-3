// VidSrc Provider for Nuvio
// Fetches streams from vidsrc.to / vidsrc.me
// Hermes-compatible: uses regeneratorRuntime-style generators (transpiled)

"use strict";

var _regeneratorRuntime = (function () {
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}
  var Gp = GeneratorFunctionPrototype.prototype = {};
  GeneratorFunction.prototype = GeneratorFunctionPrototype;
  Gp[typeof Symbol !== "undefined" && Symbol.iterator || "@@iterator"] = function () { return this; };
  Gp.next = function (v) { return this._invoke("next", v); };
  Gp["return"] = function (v) { return this._invoke("return", v); };
  Gp["throw"] = function (v) { return this._invoke("throw", v); };

  function makeInvokeMethod(innerFn, self, context) {
    var state = "suspendedStart";
    return function invoke(method, arg) {
      if (state === "executing") throw new Error("Generator is already running");
      if (state === "completed") {
        if (method === "throw") throw arg;
        return { value: undefined, done: true };
      }
      context.method = method;
      context.arg = arg;
      while (true) {
        state = "executing";
        var record = { type: "normal", arg: innerFn.call(self, context) };
        if (record.type === "normal") {
          state = context.done ? "completed" : "suspendedYield";
          if (record.arg === ContinueSentinel) continue;
          return { value: record.arg, done: context.done };
        } else if (record.type === "throw") {
          state = "completed";
          throw record.arg;
        }
      }
    };
  }

  var ContinueSentinel = {};
  function Context(tryLocsList) {
    this.tryEntries = [{ tryLoc: "root" }];
    this.reset(true);
  }
  Context.prototype = {
    constructor: Context,
    reset: function(skipTempReset) {
      this.prev = 0; this.next = 0; this.sent = undefined;
      this.done = false; this.delegate = null;
      this.method = "next"; this.arg = undefined;
      this.tryEntries.forEach(function(e) { e.completion = { type: "normal" }; });
      if (!skipTempReset) { for (var k in this) { if (k.charAt(0) === "t" && Object.prototype.hasOwnProperty.call(this, k) && !isNaN(+k.slice(1))) { this[k] = undefined; } } }
    },
    stop: function() { this.done = true; return this.arg; },
    abrupt: function(type, arg) { this.method = type; this.arg = arg; return ContinueSentinel; },
    complete: function(record, afterLoc) {
      if (record.type === "throw") throw record.arg;
      if (record.type === "return") { this.rval = this.arg = record.arg; this.method = "return"; this.next = "end"; }
      else if (record.type === "break" || record.type === "continue") { this.next = record.arg; }
      return ContinueSentinel;
    },
    finish: function(finallyLoc) { return ContinueSentinel; },
    "catch": function(tryLoc) { throw this.arg; },
    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = { iterator: iterable, resultName: resultName, nextLoc: nextLoc };
      if (this.method === "next") { this.arg = undefined; }
      return ContinueSentinel;
    }
  };

  return {
    wrap: function(innerFn, outerFn, self, tryLocsList) {
      var generator = Object.create(Gp);
      generator._invoke = makeInvokeMethod(innerFn, self, new Context(tryLocsList));
      return generator;
    }
  };
})();

// --- Provider Logic ---

var PROVIDER_NAME = "VidSrc";

var SOURCES = [
  "https://vidsrc.to/embed",
  "https://vidsrc.me/embed",
  "https://vidsrc.net/embed"
];

function buildUrl(base, mediaType, tmdbId, season, episode) {
  if (mediaType === "movie") {
    return base + "/movie?tmdb=" + tmdbId;
  } else {
    return base + "/tv?tmdb=" + tmdbId + "&season=" + season + "&episode=" + episode;
  }
}

function fetchWithTimeout(url, options, timeout) {
  timeout = timeout || 10000;
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function() {
      reject(new Error("Request timed out: " + url));
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

function trySource(base, mediaType, tmdbId, season, episode) {
  var url = buildUrl(base, mediaType, tmdbId, season, episode);
  var referer = base.split("/embed")[0];
  return fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": referer + "/"
    }
  }, 12000).then(function(res) {
    if (!res.ok) return null;
    return res.text();
  }).then(function(html) {
    if (!html) return null;
    // Extract direct video URLs or iframe sources from response
    var streams = [];
    // Look for m3u8 or mp4 links
    var m3u8Matches = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g) || [];
    var mp4Matches = html.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g) || [];
    m3u8Matches.forEach(function(m) {
      if (streams.length < 3) {
        streams.push({
          name: PROVIDER_NAME,
          title: "HLS Stream",
          url: m,
          quality: "Auto",
          headers: { "Referer": url, "Origin": referer }
        });
      }
    });
    mp4Matches.forEach(function(m) {
      if (streams.length < 5) {
        streams.push({
          name: PROVIDER_NAME,
          title: "MP4 Stream",
          url: m,
          quality: "720p",
          headers: { "Referer": url, "Origin": referer }
        });
      }
    });
    // If no direct links, provide the embed URL as a fallback stream
    if (streams.length === 0) {
      streams.push({
        name: PROVIDER_NAME,
        title: "VidSrc Embed",
        url: url,
        quality: "Auto",
        headers: { "Referer": referer + "/", "User-Agent": "Mozilla/5.0" }
      });
    }
    return streams;
  })["catch"](function() {
    return null;
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  var promises = SOURCES.map(function(base) {
    return trySource(base, mediaType, tmdbId, season, episode);
  });

  return Promise.all(promises).then(function(results) {
    var allStreams = [];
    results.forEach(function(r) {
      if (r && Array.isArray(r)) {
        r.forEach(function(s) { allStreams.push(s); });
      }
    });
    return allStreams;
  });
}
