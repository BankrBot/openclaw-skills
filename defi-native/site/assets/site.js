
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var repaint = [];
  var root = document.documentElement;

  /* ============ theme: light is the default, dark is opt in ============ */

  function effective() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function syncButtons() {
    var now = effective();
    var btns = document.querySelectorAll("[data-theme-set]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-pressed", btns[i].getAttribute("data-theme-set") === now ? "true" : "false");
    }
  }

  try {
    var stored = localStorage.getItem("dn-theme");
    if (stored === "dark") { root.setAttribute("data-theme", "dark"); }
    else if (stored === "light") { root.removeAttribute("data-theme"); }
  } catch (e) { /* blocked storage: stay on the light default */ }

  syncButtons();

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-theme-set]");
    if (!t) return;
    var v = t.getAttribute("data-theme-set");
    if (v === "dark") { root.setAttribute("data-theme", "dark"); }
    else { root.removeAttribute("data-theme"); }
    try { localStorage.setItem("dn-theme", v); } catch (err) {}
    syncButtons();
    for (var i = 0; i < repaint.length; i++) { repaint[i](); }
  });

  function token(name) {
    return getComputedStyle(root).getPropertyValue(name).trim() || "#888";
  }

  /* ============ copy ============ */

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-copy]");
    if (!btn) return;
    var src = document.getElementById(btn.getAttribute("data-copy"));
    if (!src) return;
    var text = src.textContent.replace(/ /g, " ").trim();
    var prev = btn.textContent;
    function done() {
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = prev; }, 1400);
    }
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", "");
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch (err) {
        btn.textContent = "Select it";
        setTimeout(function () { btn.textContent = prev; }, 1600);
      }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else { fallback(); }
    } catch (err) { fallback(); }
  });

  /* ============ tabs ============ */

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-tab]");
    if (!b) return;
    var list = b.parentNode;
    var panes = list.parentNode.querySelector(".panes");
    if (!panes) return;
    var all = list.querySelectorAll("[data-tab]");
    for (var i = 0; i < all.length; i++) { all[i].setAttribute("aria-selected", "false"); }
    b.setAttribute("aria-selected", "true");
    var ps = panes.querySelectorAll(".pane");
    for (var j = 0; j < ps.length; j++) { ps[j].removeAttribute("data-open"); }
    var target = panes.querySelector("#" + b.getAttribute("data-tab"));
    if (target) target.setAttribute("data-open", "1");
  });

  /* ============ halftone sampler ============ */

  function sampleGrid(off, step, lumFloor) {
    var w = off.width, h = off.height;
    var data = off.getContext("2d").getImageData(0, 0, w, h).data;
    var cells = [];
    var floor = lumFloor === undefined ? 0.06 : lumFloor;
    for (var y = step / 2; y < h; y += step) {
      for (var x = step / 2; x < w; x += step) {
        var px = (Math.floor(y) * w + Math.floor(x)) * 4;
        var a = data[px + 3] / 255;
        if (a < 0.04) continue;
        var lum = (0.299 * data[px] + 0.587 * data[px + 1] + 0.114 * data[px + 2]) / 255;
        var v = lum * a;
        if (v < floor) continue;
        cells.push({ x: x, y: y, v: v });
      }
    }
    return cells;
  }

  function fit(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return null;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    return { dpr: dpr, cssW: w, W: canvas.width, H: canvas.height };
  }

  /* ============ pixel candlesticks ============
     Ornament, not a claim about any market: a fixed series, no axis, no
     numbers. Up filled, down hollow, so the page keeps one accent hue. */

  function candles() {
    var canvas = document.getElementById("candles");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");

    var levels = [6,9,11,9,13,16,13,17,19,17,20,24,21,24,26,24,28,31,28,32,35,33,37,40,38,42,45,43,47,50,48,52,55,53,57,60];
    var wickUp = [2,1,2,1,1,2,1,2,1,1,2,1,1,2,2,1,1,2,1,2,1,1,2,1,2,1,1,2,1,1,2,2,1,2,1,2];
    var wickDn = [1,2,1,1,2,1,2,1,2,1,1,2,2,1,1,2,1,1,2,1,2,2,1,2,1,1,2,1,2,2,1,1,2,1,2,1];

    var raf = null;

    function draw() {
      if (raf) cancelAnimationFrame(raf);
      var m = fit(canvas);
      if (!m) return;
      var W = m.W, H = m.H;

      var green = token("--green");
      var down = token("--dim");
      var faint = token("--faint");

      var cell = Math.max(4, Math.round(5.4 * m.dpr));
      var inset = 2;
      var cols = Math.floor(W / cell);
      var rows = Math.floor(H / cell);
      var pitch = 6;

      var count = Math.min(levels.length, Math.max(6, Math.floor((cols - inset * 2) / pitch)));
      var from = levels.length - count;
      var lv = levels.slice(from), wu = wickUp.slice(from), wd = wickDn.slice(from);

      var lo = Infinity, hi = -Infinity;
      for (var q = 0; q < lv.length; q++) {
        var o = q === 0 ? lv[0] - 3 : lv[q - 1];
        hi = Math.max(hi, Math.max(o, lv[q]) + wu[q]);
        lo = Math.min(lo, Math.min(o, lv[q]) - wd[q]);
      }

      var pad = 3;
      var usable = Math.max(4, rows - pad * 2);
      function rowOf(v) {
        var t = (v - lo) / (hi - lo || 1);
        return pad + Math.round((1 - t) * (usable - 1));
      }

      var inner = Math.max(2, cell - 1);
      var t0 = null;
      var dur = reduce ? 0 : 760;

      function edge(cx) {
        var t = cx / W;
        return Math.max(0, Math.min(1, Math.min(t / 0.1, (1 - t) / 0.1, 1)));
      }

      function frame(ts) {
        if (t0 === null) t0 = ts;
        var p = dur === 0 ? 1 : Math.min(1, (ts - t0) / dur);
        var ease = 1 - Math.pow(1 - p, 3);

        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = faint;
        for (var gy = 1; gy < rows; gy += 3) {
          for (var gx = 1; gx < cols; gx += 3) {
            var ga = edge(gx * cell) * 0.2 * ease;
            if (ga < 0.03) continue;
            ctx.globalAlpha = ga;
            ctx.fillRect(gx * cell, gy * cell, Math.max(1, cell - 4), Math.max(1, cell - 4));
          }
        }

        for (var i = 0; i < lv.length; i++) {
          var reveal = Math.max(0, Math.min(1, (ease - (i / lv.length) * 0.5) / 0.5));
          if (reveal <= 0) continue;

          var col = inset + i * pitch;
          var close = lv[i];
          var open = i === 0 ? lv[0] - 3 : lv[i - 1];
          var up = close >= open;

          var bodyTop = rowOf(Math.max(open, close));
          var bodyBot = rowOf(Math.min(open, close));
          var wTop = rowOf(Math.max(open, close) + wu[i]);
          var wBot = rowOf(Math.min(open, close) - wd[i]);

          var a = edge(col * cell) * reveal;
          if (a < 0.03) continue;
          ctx.globalAlpha = a;
          ctx.fillStyle = up ? green : down;

          for (var wy = wTop; wy <= wBot; wy++) {
            ctx.fillRect((col + 1) * cell, wy * cell, inner, inner);
          }

          var bh = Math.max(2, bodyBot - bodyTop + 1);
          for (var by = bodyTop; by < bodyTop + bh; by++) {
            for (var bx = col; bx < col + 3; bx++) {
              var onEdge = (by === bodyTop || by === bodyTop + bh - 1 || bx === col || bx === col + 2);
              if (!up && !onEdge) continue;
              ctx.fillRect(bx * cell, by * cell, inner, inner);
            }
          }
        }
        ctx.globalAlpha = 1;

        if (p < 1) raf = requestAnimationFrame(frame);
      }

      raf = requestAnimationFrame(frame);
    }

    repaint.push(draw);
    draw();
    var t;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(draw, 130); });
  }

  /* ============ machine, halftoned ============ */

  function machine() {
    var canvas = document.getElementById("machine-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");

    function roundRect(c, x, y, w, h, r) {
      c.beginPath(); c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function draw() {
      var m = fit(canvas);
      if (!m) return;
      var W = m.W, H = m.H;

      var off = document.createElement("canvas");
      off.width = W; off.height = H;
      var o = off.getContext("2d");

      var s = Math.min(W / 540, H / 420);
      o.save();
      o.translate(W / 2 - 260 * s, H / 2 - 208 * s);
      o.scale(s, s);

      var shell = o.createLinearGradient(90, 30, 430, 260);
      shell.addColorStop(0, "#ffffff"); shell.addColorStop(0.55, "#b2b2b2"); shell.addColorStop(1, "#444444");
      o.fillStyle = shell; roundRect(o, 92, 34, 336, 226, 26); o.fill();

      o.fillStyle = "#eeeeee"; roundRect(o, 132, 70, 256, 150, 8); o.fill();
      o.fillStyle = "#151515"; roundRect(o, 146, 82, 228, 126, 5); o.fill();

      o.fillStyle = "#e4e4e4";
      var widths = [150, 96, 176, 62, 120];
      for (var r = 0; r < widths.length; r++) { o.fillRect(160, 98 + r * 21, widths[r], 7); }

      var kb = o.createLinearGradient(40, 276, 480, 390);
      kb.addColorStop(0, "#ffffff"); kb.addColorStop(0.6, "#a2a2a2"); kb.addColorStop(1, "#383838");
      o.fillStyle = kb;
      o.beginPath(); o.moveTo(46, 286); o.lineTo(474, 286); o.lineTo(432, 386); o.lineTo(88, 386); o.closePath(); o.fill();

      o.fillStyle = "#2a2a2a";
      for (var row = 0; row < 4; row++) {
        for (var col = 0; col < 13; col++) {
          var kx = 92 + col * 25 + row * 7, ky = 300 + row * 19;
          if (kx > 420) continue;
          o.fillRect(kx, ky, 17, 12);
        }
      }
      o.restore();

      var step = Math.max(4, Math.round(5 * m.dpr));
      var cells = sampleGrid(off, step, 0);

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = token("--field-ink");
      var rMax = step * 0.5;
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        var rr = rMax * (1 - c.v * 0.8);
        if (rr < 0.3) continue;
        ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, 6.2832); ctx.fill();
      }
    }

    repaint.push(draw);
    draw();
    var t;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(draw, 140); });
  }

  /* ============ routing schematic ============ */

  function schematic() {
    var g = document.getElementById("sch-g");
    if (!g) return;
    var svg = g.ownerSVGElement;
    var NS = "http://www.w3.org/2000/svg";

    var routes = [
      ["LEARN",          "foundations",       "TradFi to onchain",          "what is repo, in defi terms?"],
      ["ASSESS",         "playbook",          "sizing risk and opportunity", "assess this vault before I put $5k in"],
      ["OPTIONS",        "onchain options",   "puts, calls, and strikes",   "how do onchain options work?"],
      ["TRADES",         "trade types",       "how trades and hedges work", "locked tokens at a discount, what is the catch?"],
      ["MICROSTRUCTURE", "depth and squeezes", "how markets actually move",  "short squeeze, or a crowded exit?"],
      ["CURATORS",       "crypto's asset managers", "their due diligence frameworks", "should I trust this vault curator?"],
      ["TOKENS",         "value accrual",     "tokenomics and valuations",  "does this token actually earn anything?"],
      ["PERPS",          "funding and basis", "margin, venues, liquidations", "why is funding negative right now?"],
      ["MONITOR",        "market pulse",      "what changed this week",     "what changed in defi this week?"]
    ];
    var order = [1, 4, 8, 0, 7, 2, 6, 3, 5];

    var timers = [], rafs = [], running = false, mode = null, api = null;

    function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
    function everything_stop() {
      timers.forEach(clearTimeout); timers = [];
      rafs.forEach(cancelAnimationFrame); rafs = [];
    }

    function el(name, attrs, style) {
      var n = document.createElementNS(NS, name);
      for (var k in attrs) { n.setAttribute(k, attrs[k]); }
      if (style) { n.setAttribute("style", style); }
      g.appendChild(n);
      return n;
    }
    function trace(x1, y1, x2, y2) {
      el("line", { x1: x1, y1: y1, x2: x2, y2: y2, "shape-rendering": "crispEdges" },
         "stroke: var(--rule-hi); stroke-width: 1.5; stroke-dasharray: 1.5 3.5;");
    }
    function via(x, y) {
      el("rect", { x: x - 2.5, y: y - 2.5, width: 5, height: 5, "shape-rendering": "crispEdges" },
         "fill: var(--green);");
    }
    function txt(x, y, text, cls, style) {
      var t = el("text", { x: x, y: y, "class": cls }, style);
      t.textContent = text;
      return t;
    }
    function box(x, y, w, h, o) {
      var r = el("rect", { x: x, y: y, width: w, height: h, "shape-rendering": "crispEdges" },
         "fill: " + (o.fill || "var(--panel)") + "; stroke: " + (o.stroke || "var(--rule)") + "; stroke-width: 1; transition: stroke .25s, fill .25s;");
      var pad = 14;
      var nodes = { rect: r };
      if (o.tag)   { nodes.tag   = txt(x + pad, y + 19, o.tag,   "g", "fill: var(--green-text);"); }
      if (o.title) { nodes.title = txt(x + pad, y + (o.tag ? 38 : 26), o.title, "t", "fill: var(--ink);"); }
      if (o.sub)   { nodes.sub   = txt(x + pad, y + (o.tag ? 53 : 42), o.sub,   "s", "fill: var(--dim);"); }
      return nodes;
    }
    function dot(size) {
      return el("rect", { x: -9, y: -9, width: size, height: size, "shape-rendering": "crispEdges" },
        "fill: var(--green); opacity: 0;");
    }

    /* run a dot along one polyline; done() when it lands */
    function run(pulse, pts, speed, done) {
      var segs = [], total = 0;
      for (var k = 0; k < pts.length - 1; k++) {
        var d = Math.abs(pts[k + 1][0] - pts[k][0]) + Math.abs(pts[k + 1][1] - pts[k][1]);
        segs.push(d); total += d;
      }
      var t0 = null, dur = Math.max(260, total * (speed || 1.6));
      var half = (parseFloat(pulse.getAttribute("width")) || 6) / 2;
      pulse.style.opacity = "1";
      function step(ts) {
        if (t0 === null) t0 = ts;
        var f = Math.min(1, (ts - t0) / dur);
        var dist = f * total, acc = 0, x = pts[0][0], y = pts[0][1];
        for (var k = 0; k < segs.length; k++) {
          if (dist <= acc + segs[k]) {
            var lf = segs[k] ? (dist - acc) / segs[k] : 1;
            x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * lf;
            y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * lf;
            break;
          }
          acc += segs[k]; x = pts[k + 1][0]; y = pts[k + 1][1];
        }
        pulse.setAttribute("x", x - half); pulse.setAttribute("y", y - half);
        if (f < 1) { rafs.push(requestAnimationFrame(step)); }
        else { pulse.style.opacity = "0"; if (done) done(); }
      }
      rafs.push(requestAnimationFrame(step));
    }

    /* run a dot through pieces in sequence (it disappears inside boxes) */
    function runPieces(pulse, pieces, speed, done) {
      var i = 0;
      function next() {
        if (i >= pieces.length) { if (done) done(); return; }
        run(pulse, pieces[i++], speed, next);
      }
      next();
    }

    /* type a string into text nodes, hero-terminal style */
    function typeInto(nodes, split, s, done) {
      nodes.forEach(function (n) { n.textContent = ""; });
      var parts = split(s);
      var pi = 0, ci = 0;
      function tick() {
        if (pi >= parts.length) { if (done) done(); return; }
        ci++;
        nodes[pi].textContent = parts[pi].slice(0, ci);
        if (ci >= parts[pi].length) { pi++; ci = 0; }
        later(tick, 34);
      }
      tick();
    }

    /* ---------- desktop ---------- */
    function buildDesktop() {
      svg.setAttribute("viewBox", "0 0 960 566");
      svg.classList.remove("sch-mobile");

      var q = box(340, 6, 280, 42, { title: "", fill: "var(--sunk)", stroke: "var(--rule-hi)" });
      q.title = txt(354, 32, "", "t", "fill: var(--ink);");
      trace(480, 48, 480, 66); via(480, 68);
      box(290, 76, 380, 56, { tag: "THE SKILL", title: "reads the question, picks the file", fill: "var(--raise)", stroke: "var(--green)" });
      trace(480, 132, 480, 150); via(480, 152);

      var colX = [16, 332, 648], cw = 296, mid = 148;
      trace(colX[0] + mid, 160, colX[2] + mid, 160);
      for (var i = 0; i < 3; i++) { trace(colX[i] + mid, 160, colX[i] + mid, 176); }

      var rowY = [176, 250, 324];
      var cards = routes.map(function (r, j) {
        return box(colX[j % 3], rowY[Math.floor(j / 3)], cw, 62,
          { tag: r[0], title: r[1], sub: r[2] });
      });

      trace(480, 386, 480, 410); via(480, 412);
      trace(300, 412, 660, 412);
      trace(300, 412, 300, 420);
      trace(660, 412, 660, 420);
      box(150, 420, 300, 56, { tag: "GROUND IT", title: "concepts", sub: "the building blocks of finance", fill: "var(--raise)", stroke: "var(--rule-hi)" });
      box(510, 420, 300, 56, { tag: "PULL IT LIVE", title: "31 API routes", sub: "pulls the latest numbers", fill: "var(--raise)", stroke: "var(--rule-hi)" });
      trace(300, 476, 300, 492);
      trace(660, 476, 660, 492);
      trace(300, 492, 660, 492);
      trace(480, 492, 480, 508); via(480, 510);
      box(140, 514, 680, 44, { fill: "var(--sunk)", stroke: "var(--green)" });
      txt(154, 541, "One answer: who pays the yield, what breaks it, dated numbers. Research, not advice.", "t", "fill: var(--green-text);");

      var hot = el("polyline", { points: "", fill: "none", "shape-rendering": "crispEdges" },
        "stroke: var(--green); stroke-width: 1.5; opacity: 0;");
      var routeDot = dot(6);
      var flowDot = dot(4);

      function pathFor(j) {
        var c = j % 3, row = Math.floor(j / 3);
        var cx = colX[c] + mid, topY = rowY[row];
        if (row === 0) { return [[480, 160], [cx, 160], [cx, 176]]; }
        var gx = (c === 2) ? 638 : 322;
        var edgeX = (c === 0) ? 312 : (c === 1 ? 332 : 648);
        return [[480, 160], [gx, 160], [gx, topY + 31], [edgeX, topY + 31]];
      }

      var current = -1;
      function setActive(j, on) {
        if (j < 0) return;
        var c = cards[j];
        c.rect.style.stroke = on ? "var(--green)" : "var(--rule)";
        c.rect.style.strokeWidth = on ? "1.5" : "1";
        c.rect.style.fill = on ? "var(--raise)" : "var(--panel)";
      }
      function show(j, animate) {
        var pts = [[480, 132]].concat(pathFor(j));
        function land() {
          hot.setAttribute("points", pts.map(function (p) { return p.join(","); }).join(" "));
          hot.style.opacity = "1";
          setActive(j, true);
          current = j;
        }
        if (!animate) { q.title.textContent = routes[j][3]; land(); return; }
        hot.style.opacity = "0";
        setActive(current, false);
        typeInto([q.title], function (s) { return [s]; }, routes[j][3], function () {
          runPieces(routeDot, [[[480, 48], [480, 68]], pts], 1.4, land);
        });
      }

      /* the ground loop: a smaller dot forever cycling through the lower circuit */
      var lap = 0;
      function flow() {
        var x = lap % 2 === 0 ? 300 : 660;
        lap++;
        runPieces(flowDot, [
          [[480, 386], [480, 412], [x, 412], [x, 420]],
          [[x, 476], [x, 492], [480, 492], [480, 512]]
        ], 2.6, function () { later(flow, 900); });
      }

      return { show: show, flow: flow };
    }

    /* ---------- mobile ---------- */
    function buildMobile() {
      svg.setAttribute("viewBox", "0 0 360 400");
      svg.classList.add("sch-mobile");
      var S = 180;

      box(20, 6, 320, 56, { fill: "var(--sunk)", stroke: "var(--rule-hi)" });
      var q1 = txt(34, 29, "", "s", "fill: var(--ink);");
      var q2 = txt(34, 46, "", "s", "fill: var(--ink);");
      trace(S, 62, S, 78); via(S, 80);

      box(20, 88, 320, 52, { tag: "THE SKILL", title: "reads it, picks the file", fill: "var(--raise)", stroke: "var(--green)" });
      trace(S, 140, S, 164);

      var slot = box(20, 168, 320, 62, { tag: routes[1][0], title: routes[1][1], sub: routes[1][2], fill: "var(--raise)", stroke: "var(--green)" });
      slot.rect.style.strokeWidth = "1.5";
      var idx = txt(326, 187, "", "g", "fill: var(--dim); text-anchor: end;");

      trace(S, 230, S, 244); via(S, 246);
      trace(96, 246, 264, 246);
      trace(96, 246, 96, 254);
      trace(264, 246, 264, 254);
      box(20, 254, 152, 60, { tag: "GROUND IT", title: "concepts", sub: "building blocks", fill: "var(--raise)", stroke: "var(--rule-hi)" });
      box(188, 254, 152, 60, { tag: "PULL IT LIVE", title: "31 APIs", sub: "latest numbers", fill: "var(--raise)", stroke: "var(--rule-hi)" });
      trace(96, 314, 96, 322);
      trace(264, 314, 264, 322);
      trace(96, 322, 264, 322);
      trace(S, 322, S, 330); via(S, 332);

      box(20, 336, 320, 56, { fill: "var(--sunk)", stroke: "var(--green)" });
      txt(34, 359, "One answer: who pays the yield,", "s", "fill: var(--green-text);");
      txt(34, 376, "what breaks it, dated. Not advice.", "s", "fill: var(--green-text);");

      var routeDot = dot(6);
      var flowDot = dot(4);

      function splitQ(s) {
        if (s.length <= 36) return [s];
        var cut = s.lastIndexOf(" ", Math.max(20, Math.ceil(s.length / 2) + 3));
        return cut > 0 ? [s.slice(0, cut), s.slice(cut + 1)] : [s];
      }

      function show(j, animate) {
        function land() {
          slot.tag.textContent = routes[j][0];
          slot.title.textContent = routes[j][1];
          slot.sub.textContent = routes[j][2];
          idx.textContent = "FILE " + (j + 1) + "/9";
        }
        var parts = splitQ(routes[j][3]);
        q1.setAttribute("y", parts.length > 1 ? 29 : 38);
        if (!animate) { q1.textContent = parts[0]; q2.textContent = parts[1] || ""; land(); return; }
        [slot.tag, slot.title, slot.sub, idx].forEach(function (n) { n.style.transition = "opacity .18s"; n.style.opacity = "0.35"; });
        typeInto([q1, q2], splitQ, routes[j][3], function () {
          runPieces(routeDot, [[[S, 62], [S, 82]], [[S, 140], [S, 166]]], 2.2, function () {
            land();
            [slot.tag, slot.title, slot.sub, idx].forEach(function (n) { n.style.opacity = "1"; });
          });
        });
      }

      var lap = 0;
      function flow() {
        var x = lap % 2 === 0 ? 96 : 264;
        lap++;
        runPieces(flowDot, [
          [[S, 230], [S, 246], [x, 246], [x, 254]],
          [[x, 314], [x, 322], [S, 322], [S, 334]]
        ], 3.2, function () { later(flow, 800); });
      }

      return { show: show, flow: flow };
    }

    function build() {
      var w = svg.parentNode.clientWidth || 960;
      var next = w < 880 ? "mobile" : "desktop";
      if (next === mode) return;
      everything_stop();
      running = false;
      mode = next;
      g.innerHTML = "";
      api = (mode === "mobile") ? buildMobile() : buildDesktop();
      api.show(1, false);
      if (!reduce && visible) start();
    }

    if (reduce) { mode = null; build(); return; }

    var oi = 0, visible = false;
    function cycle() {
      var j = order[oi];
      oi = (oi + 1) % order.length;
      api.show(j, true);
    }
    function start() {
      if (running) return;
      running = true;
      api.flow();
      function loop() { cycle(); later(loop, 4600); }
      later(loop, 1400);
    }
    function stop() { running = false; everything_stop(); }

    mode = null; build();

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        visible ? start() : stop();
      }, { threshold: 0.2 }).observe(svg);
    } else { visible = true; start(); }

    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { mode = null; build(); }, 200); });
  }

  /* ============ the prompt types itself ============
     Deletes and retypes through a few real questions. Static under
     reduced motion, and hidden from assistive tech, which reads the
     visually hidden sentence beside it instead. */

  function typer() {
    var el = document.getElementById("typed");
    if (!el) return;
    var lines = [
      "this vault pays 7% on USDC. is that real?",
      "what is actually backing this yield?",
      "are onchain options the same as traditional options?",
      "what is actually backing sUSDe?"
    ];
    if (reduce) { el.textContent = lines[lines.length - 1]; return; }

    var li = 0, ci = 0, deleting = false;

    function tick() {
      var full = lines[li];
      if (!deleting) {
        ci++;
        el.textContent = full.slice(0, ci);
        if (ci >= full.length) { deleting = true; setTimeout(tick, 2100); return; }
        setTimeout(tick, 46);
        return;
      }
      ci--;
      el.textContent = full.slice(0, ci);
      if (ci <= 0) { deleting = false; li = (li + 1) % lines.length; setTimeout(tick, 380); return; }
      setTimeout(tick, 20);
    }

    setTimeout(tick, 800);
  }

  /* the fade would otherwise sit over the last entry forever */
  function logFade() {
    var log = document.querySelector(".log");
    if (!log || !log.parentNode) return;
    var wrap = log.parentNode;
    function update() {
      var atEnd = log.scrollTop + log.clientHeight >= log.scrollHeight - 4;
      wrap.classList.toggle("at-end", atEnd);
    }
    log.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  candles();
  machine();

  schematic();
  typer();
  logFade();
})();

/* ============ menu ============ */
(function () {
  var btn = document.querySelector(".menubtn");
  var panel = document.getElementById("sitemenu");
  if (!btn || !panel) return;
  function close() { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); }
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    var opening = panel.hidden;
    panel.hidden = !opening;
    btn.setAttribute("aria-expanded", String(opening));
  });
  document.addEventListener("click", function (e) {
    if (!panel.hidden && !panel.contains(e.target)) close();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  panel.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
})();

/* ============ github stars ============ */
(function () {
  var el = document.getElementById("gh-stars");
  if (!el || typeof fetch !== "function") return;
  fetch("https://api.github.com/repos/emlai/defi-native-skill")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (d && typeof d.stargazers_count === "number" && d.stargazers_count > 0) {
        el.textContent = d.stargazers_count;
      }
    })
    .catch(function () { /* keep the baked-in count */ });
})();

/* ============ #faq-token: the menu's Token link opens the disclosure ============ */
(function () {
  function openToken() {
    if (location.hash !== "#faq-token") return;
    var el = document.getElementById("faq-token");
    if (el) el.open = true;
  }
  window.addEventListener("hashchange", openToken);
  openToken();
})();

/* ============ brand click: back to the very top ============
   The header is sticky, so an anchor to it is "already in view" and the
   browser will not scroll. Do it by hand. */
(function () {
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a.brand[href="#top"]');
    if (!a) return;
    e.preventDefault();
    var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
    if (history.replaceState) { history.replaceState(null, "", location.pathname + location.search); }
  });
})();
