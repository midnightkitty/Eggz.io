! function(e) {
  if ("object" == typeof exports && "undefined" != typeof module) module.exports = e();
  else if ("function" == typeof define && define.amd) define([], e);
  else {
    var n;
    n = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this, n.uuidv1 = e()
  }
}(function() {
  return function e(n, r, o) {
    function t(f, u) {
      if (!r[f]) {
        if (!n[f]) {
          var d = "function" == typeof require && require;
          if (!u && d) return d(f, !0);
          if (i) return i(f, !0);
          var s = new Error("Cannot find module '" + f + "'");
          throw s.code = "MODULE_NOT_FOUND", s
        }
        var a = r[f] = {
          exports: {}
        };
        n[f][0].call(a.exports, function(e) {
          var r = n[f][1][e];
          return t(r ? r : e)
        }, a, a.exports, e, n, r, o)
      }
      return r[f].exports
    }
    for (var i = "function" == typeof require && require, f = 0; f < o.length; f++) t(o[f]);
    return t
  }({
    1: [function(e, n, r) {
      function o(e, n) {
        var r = n || 0,
          o = t;
        return o[e[r++]] + o[e[r++]] + o[e[r++]] + o[e[r++]] + "-" + o[e[r++]] + o[e[r++]] + "-" + o[e[r++]] + o[e[r++]] + "-" + o[e[r++]] + o[e[r++]] + "-" + o[e[r++]] + o[e[r++]] + o[e[r++]] + o[e[r++]] + o[e[r++]] + o[e[r++]]
      }
      for (var t = [], i = 0; i < 256; ++i) t[i] = (i + 256).toString(16).substr(1);
      n.exports = o
    }, {}],
    2: [function(e, n, r) {
      (function(e) {
        var r, o = e.crypto || e.msCrypto;
        if (o && o.getRandomValues) {
          var t = new Uint8Array(16);
          r = function() {
            return o.getRandomValues(t), t
          }
        }
        if (!r) {
          var i = new Array(16);
          r = function() {
            for (var e, n = 0; n < 16; n++) 0 === (3 & n) && (e = 4294967296 * Math.random()), i[n] = e >>> ((3 & n) << 3) & 255;
            return i
          }
        }
        n.exports = r
      }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {})
    }, {}],
    3: [function(e, n, r) {
      function o(e, n, r) {
        var o = n && r || 0,
          t = n || [];
        e = e || {};
        var f = void 0 !== e.clockseq ? e.clockseq : d,
          c = void 0 !== e.msecs ? e.msecs : (new Date).getTime(),
          l = void 0 !== e.nsecs ? e.nsecs : a + 1,
          v = c - s + (l - a) / 1e4;
        if (v < 0 && void 0 === e.clockseq && (f = f + 1 & 16383), (v < 0 || c > s) && void 0 === e.nsecs && (l = 0), l >= 1e4) throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
        s = c, a = l, d = f, c += 122192928e5;
        var p = (1e4 * (268435455 & c) + l) % 4294967296;
        t[o++] = p >>> 24 & 255, t[o++] = p >>> 16 & 255, t[o++] = p >>> 8 & 255, t[o++] = 255 & p;
        var y = c / 4294967296 * 1e4 & 268435455;
        t[o++] = y >>> 8 & 255, t[o++] = 255 & y, t[o++] = y >>> 24 & 15 | 16, t[o++] = y >>> 16 & 255, t[o++] = f >>> 8 | 128, t[o++] = 255 & f;
        for (var w = e.node || u, b = 0; b < 6; ++b) t[o + b] = w[b];
        return n ? n : i(t)
      }
      var t = e("./lib/rng"),
        i = e("./lib/bytesToUuid"),
        f = t(),
        u = [1 | f[0], f[1], f[2], f[3], f[4], f[5]],
        d = 16383 & (f[6] << 8 | f[7]),
        s = 0,
        a = 0;
      n.exports = o
    }, {
      "./lib/bytesToUuid": 1,
      "./lib/rng": 2
    }]
  }, {}, [3])(3)
});
