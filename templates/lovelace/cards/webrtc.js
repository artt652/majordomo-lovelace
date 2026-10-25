/* ============================================================================
 * ВНЕШНЯЯ карточка: камера go2rtc (снапшот + живой поток HD/SD, скачивание, probe).
 * Положить в  cards/webrtc.js  и добавить "webrtc.js" в cards/index.json.
 * Ядро панели и API НЕ меняются.
 *
 * Поля (полные URL):
 *   URL снапшота — кадр,   напр. http://IP:84/api/frame.jpeg?src=P4
 *   URL HD       — плеер,  напр. http://IP:84/stream.html?src=P4
 *   URL SD       — плеер,  напр. http://IP:84/stream.html?src=P4_sub
 *   URL probe    — инфо-страница потока (открывается в новой вкладке)
 *
 * Инлайн — снапшот (постоянный <img>, без мигания). Иконка скачивания — в шапке карточки.
 * Тап — живой поток; в шапке окна: HD/SD, скачать снимок, probe.
 * ==========================================================================*/
(function () {
  if (!window.Lovelace) return;
  var L = window.Lovelace;

  var DL_SVG    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 20h14"/></svg>';
  var PROBE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3 8 4-16 3 8h4"/></svg>';
  var CAM_SVG   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  var PLAY_SVG  = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

  var st = document.createElement("style");
  st.textContent =
    ".wrtc{position:relative;border-radius:10px;overflow:hidden;background:#000;aspect-ratio:16/9;cursor:pointer;display:flex}" +
    ".wrtc-snap{width:100%;height:100%;object-fit:cover;display:block}" +
    ".wrtc-fallback{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#0e1016;color:#5a6472}" +
    ".wrtc-fallback svg{width:38px;height:38px}" +
    ".wrtc-fb-t{font:500 12px/1 system-ui,sans-serif}" +
    ".wrtc-holder.failed .wrtc-fallback{display:flex}" +
    ".wrtc-holder.failed .wrtc-snap{opacity:0}" +
    ".wrtc-stale{position:absolute;inset:0;display:none;align-items:flex-end;justify-content:center;padding-bottom:9px;background:rgba(0,0,0,.5)}" +
    ".wrtc-stale .wrtc-fb-t{color:#e9ecf2;text-shadow:0 1px 3px rgba(0,0,0,.85)}" +
    ".wrtc-holder.stale .wrtc-stale{display:flex}" +
    ".wrtc-holder{position:absolute;inset:0;display:grid;place-items:center;color:#556}" +
    ".wrtc-holder svg{width:40px;height:40px}" +
    ".wrtc-play{position:absolute;inset:0;margin:auto;width:46px;height:46px;border-radius:50%;background:rgba(0,0,0,.45);display:grid;place-items:center;color:#fff;pointer-events:none}" +
    ".wrtc-play svg{width:22px;height:22px;margin-left:2px}" +
    // иконка скачивания в шапке карточки (ядро)
    ".wrtc-hdr-dl,.wrtc-hdr-pr{margin-left:auto;flex:none;width:24px;height:24px;padding:0;border:0;background:transparent;color:var(--faint);cursor:pointer;display:grid;place-items:center}" +
    ".wrtc-hdr-dl:hover,.wrtc-hdr-dl:active,.wrtc-hdr-pr:hover,.wrtc-hdr-pr:active{color:var(--active)}" +
    ".wrtc-hdr-dl svg,.wrtc-hdr-pr svg{width:17px;height:17px}" +
    // модалка живого потока
    ".wrtc-ov{position:fixed;inset:0;z-index:80;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.85);padding:12px}" +
    ".wrtc-ov.show{display:flex}" +
    ".wrtc-box{position:relative;width:100%;max-width:920px;display:flex;flex-direction:column;gap:8px}" +
    ".wrtc-bar{display:flex;align-items:center;gap:6px}" +
    ".wrtc-sp{flex:1}" +
    ".wrtc-q{padding:6px 12px;border-radius:8px;border:1px solid #444;background:#1c1c22;color:#ddd;font:600 12px/1 system-ui,sans-serif;cursor:pointer}" +
    ".wrtc-q.active{background:#fff;color:#111;border-color:#fff}" +
    ".wrtc-ic{width:34px;height:34px;border-radius:8px;border:1px solid #444;background:#1c1c22;color:#ddd;cursor:pointer;display:grid;place-items:center}" +
    ".wrtc-ic:active{transform:scale(.9)}" +
    ".wrtc-ic svg{width:16px;height:16px}" +
    ".wrtc-close{width:34px;height:34px;border-radius:8px;border:1px solid #444;background:#1c1c22;color:#fff;font-size:15px;cursor:pointer}" +
    ".wrtc-fr{width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden}" +
    ".wrtc-frame{width:100%;height:100%;border:0;display:block;background:#000}" +
    // окно probe (JSON), в стиле окна информации
    ".wrtc-pov{position:fixed;inset:0;z-index:82;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);padding:14px}" +
    ".wrtc-pov.show{display:flex}" +
    ".wrtc-pbox{background:var(--surface,#191d27);color:var(--text,#e6e9f0);border:1px solid var(--border,#2b3040);border-radius:14px;width:100%;max-width:520px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden}" +
    ".wrtc-phead{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--border,#2b3040)}" +
    ".wrtc-phead b{font-size:14px}" +
    ".wrtc-pbody{overflow:auto;padding:12px 14px}" +
    ".wrtc-pbody pre{margin:0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word}";
  document.head.appendChild(st);

  // ---- модалка живого потока: HD/SD + скачать снимок + probe ----
  var ov = null, ovFrame = null, ovHD = null, ovSD = null, ovDL = null, ovPR = null;
  var curHD = "", curSD = "", curSnap = "", curProbe = "";
  function ensureOverlay() {
    if (ov) return;
    ov = document.createElement("div"); ov.className = "wrtc-ov";
    ov.innerHTML = '<div class="wrtc-box"><div class="wrtc-bar">' +
      '<button class="wrtc-q" data-q="hd">HD</button><button class="wrtc-q" data-q="sd">SD</button>' +
      '<span class="wrtc-sp"></span>' +
      '<button class="wrtc-ic" data-a="dl" title="Скачать снимок">' + DL_SVG + '</button>' +
      '<button class="wrtc-ic" data-a="probe" title="Probe">' + PROBE_SVG + '</button>' +
      '<button class="wrtc-close" aria-label="Закрыть">\u2715</button></div>' +
      '<div class="wrtc-fr"><iframe class="wrtc-frame" allow="autoplay; fullscreen" allowfullscreen></iframe></div></div>';
    document.body.appendChild(ov);
    ovFrame = ov.querySelector(".wrtc-frame");
    ovHD = ov.querySelector('[data-q="hd"]'); ovSD = ov.querySelector('[data-q="sd"]');
    ovDL = ov.querySelector('[data-a="dl"]'); ovPR = ov.querySelector('[data-a="probe"]');
    ov.querySelector(".wrtc-close").addEventListener("click", closeLive);
    ovHD.addEventListener("click", function () { setQuality("hd"); });
    ovSD.addEventListener("click", function () { setQuality("sd"); });
    ovDL.addEventListener("click", function () { downloadSnap(curSnap); });
    ovPR.addEventListener("click", function () { openProbe(curProbe); });
    ov.addEventListener("click", function (e) { if (e.target === ov) closeLive(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ov.classList.contains("show")) closeLive(); });
  }
  function setQuality(q) {
    var url = q === "hd" ? curHD : curSD; if (!url) return;
    ovFrame.src = url;
    ovHD.classList.toggle("active", q === "hd");
    ovSD.classList.toggle("active", q === "sd");
  }
  function openLive(hd, sd, snap, probe) {
    ensureOverlay();
    curHD = hd || ""; curSD = sd || ""; curSnap = snap || ""; curProbe = probe || "";
    ovHD.style.display = curHD ? "" : "none";
    ovSD.style.display = curSD ? "" : "none";
    ovDL.style.display = curSnap ? "" : "none";
    ovPR.style.display = curProbe ? "" : "none";
    setQuality(curHD ? "hd" : "sd");
    ov.classList.add("show");
    document.documentElement.style.overflow = "hidden";
  }
  function closeLive() {
    if (!ov) return;
    ov.classList.remove("show");
    ovFrame.src = "about:blank";
    document.documentElement.style.overflow = "";
  }

  // ---- окно probe (JSON) ----
  var pov = null, povBody = null;
  function ensureProbe() {
    if (pov) return;
    pov = document.createElement("div"); pov.className = "wrtc-pov";
    pov.innerHTML = '<div class="wrtc-pbox"><div class="wrtc-phead"><b>Probe</b><span class="wrtc-sp"></span>' +
      '<button class="wrtc-close" aria-label="Закрыть">\u2715</button></div><div class="wrtc-pbody"><pre></pre></div></div>';
    document.body.appendChild(pov);
    povBody = pov.querySelector("pre");
    pov.querySelector(".wrtc-close").addEventListener("click", closeProbe);
    pov.addEventListener("click", function (e) { if (e.target === pov) closeProbe(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && pov.classList.contains("show")) closeProbe(); });
  }
  function openProbe(url) {
    if (!url) return;
    ensureProbe();
    povBody.textContent = "Загрузка…";
    pov.classList.add("show");
    document.documentElement.style.overflow = "hidden";
    fetch(bust(url)).then(function (r) { return r.text(); }).then(function (t) {
      var out = t;
      try { out = JSON.stringify(JSON.parse(t), null, 2); } catch (e) {}   // красиво, если это JSON
      povBody.textContent = out;
    }).catch(function () {
      closeProbe(); window.open(url, "_blank");   // нет CORS -> откроем вкладкой
    });
  }
  function closeProbe() {
    if (!pov) return;
    pov.classList.remove("show");
    // если под ним всё ещё открыт живой поток — прокрутку не возвращаем
    document.documentElement.style.overflow = (ov && ov.classList.contains("show")) ? "hidden" : "";
  }

  // ---- скачивание снимка (fetch -> blob; нет CORS -> открыть вкладкой) ----
  function bust(u) { return u + (u.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now(); }
  function downloadSnap(url) {
    if (!url) return;
    var u = bust(url);
    fetch(u).then(function (r) { return r.blob(); }).then(function (b) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "snapshot_" + Date.now() + ".jpg";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }).catch(function () { window.open(u, "_blank"); });
  }

  // ---- постоянные <img> снапшота: переживают перерисовку панели ----
  var SNAP_MS = 10000, snaps = {};
  function fmtTime(ts) { var d = new Date(ts); function p(n) { return (n < 10 ? "0" : "") + n; } return p(d.getHours()) + ":" + p(d.getMinutes()); }
  function updateStaleLabel(img) {
    var p = img.parentNode; if (!p) return;
    var lab = p.querySelector(".wrtc-stale .wrtc-fb-t");
    if (lab) lab.textContent = img._lostAt ? ("Нет сигнала с " + fmtTime(img._lostAt)) : "Нет сигнала";
  }
  function setState(img, kind) {           // "" | "failed" | "stale"
    img._state = kind;
    var p = img.parentNode;
    if (p && p.classList) { p.classList.toggle("failed", kind === "failed"); p.classList.toggle("stale", kind === "stale"); }
    if (kind === "stale") updateStaleLabel(img);
  }
  function failNow(img) {                   // был кадр -> затемнение с временем, не было -> заставка
    if (img._everOk) { if (!img._lostAt) img._lostAt = Date.now(); setState(img, "stale"); }
    else setState(img, "failed");
  }
  function refreshImg(img) {
    if (!img || !img._url) return;
    var u = bust(img._url);
    var pre = new Image();
    pre.onload = function () { img.src = u; img._fails = 0; };           // держим последний удачный кадр
    pre.onerror = function () { img._fails = (img._fails || 0) + 1; if (img._fails >= 2) failNow(img); };
    pre.src = u;
  }
  // видимость: обновляем снимок только когда карточка реально на экране
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      e.target._visible = e.isIntersecting;
      if (e.isIntersecting) refreshImg(e.target);   // свежий кадр сразу при появлении
    });
  }, { rootMargin: "120px" }) : null;

  function getImg(url) {
    if (!snaps[url]) {
      var img = document.createElement("img");
      img.className = "wrtc-snap"; img.alt = ""; img._url = url; img._fails = 0; img._everOk = false;
      img.onerror = function () { failNow(img); };
      img.onload  = function () { img.style.opacity = 1; img._fails = 0; img._everOk = true; img._lostAt = 0; setState(img, ""); };
      img.src = bust(url);               // первый кадр
      if (io) io.observe(img); else img._visible = true;   // без IO — как раньше
      snaps[url] = img;
    }
    return snaps[url];
  }
  setInterval(function () {
    if (document.hidden) return;         // вкладка браузера в фоне — не трогаем
    for (var url in snaps) {
      var img = snaps[url];
      if (img._visible && img.isConnected) refreshImg(img);   // только видимые
    }
  }, SNAP_MS);

  L.register("webrtc", {
    noObject: true,
    fields: [
      { k: "snapshot", l: "URL снапшота", t: "text" },
      { k: "hd", l: "URL HD (плеер)", t: "text" },
      { k: "sd", l: "URL SD (плеер)", t: "text" },
      { k: "probe", l: "URL probe", t: "text" }
    ],
    render: function (dev, c, ctx) {
      var hd = c.hd || "", sd = c.sd || "", snap = c.snapshot || "";
      if (!hd && !sd && !snap) return '<div class="textv">Укажите URL камеры (снапшот / HD / SD)</div>';
      var holder = snap
        ? '<span class="wrtc-holder" data-snap="' + ctx.esc(snap) + '"><span class="wrtc-fallback">' + CAM_SVG + '<span class="wrtc-fb-t">Нет сигнала</span></span><span class="wrtc-stale"><span class="wrtc-fb-t">Нет сигнала</span></span></span>'
        : '<span class="wrtc-holder">' + CAM_SVG + '</span>';
      var live = (hd || sd)
        ? ' data-hd="' + ctx.esc(hd) + '" data-sd="' + ctx.esc(sd) + '" data-snap="' + ctx.esc(snap) + '" data-probe="' + ctx.esc(c.probe || "") + '"'
        : '';
      return '<div class="wrtc"' + live + '>' + holder +
        ((hd || sd) ? '<span class="wrtc-play">' + PLAY_SVG + '</span>' : '') +
        '</div>';
    },
    bind: function (el, dev, c, api) {
      var snap = c.snapshot || "";
      var holder = el.querySelector(".wrtc-holder[data-snap]");
      if (holder) {
        var img = getImg(holder.getAttribute("data-snap"));
        if (img.parentNode !== holder) holder.appendChild(img);   // перенос узла (без reload)
        holder.classList.toggle("failed", img._state === "failed");
        holder.classList.toggle("stale",  img._state === "stale");
        if (img._state === "stale") updateStaleLabel(img);
      }
      // шапка карточки (ядро): тап по ней — скачать снимок; в углу — probe (если задан)
      var top = el.closest(".card") && el.closest(".card").querySelector(".card-top");
      if (top) {
        if (snap && !top._wrtcTap) {
          top._wrtcTap = true; top.style.cursor = "pointer"; top.title = "Скачать снимок";
          top.addEventListener("click", function () { downloadSnap(snap); });
        }
        if (c.probe && !top.querySelector(".wrtc-hdr-pr")) {
          var pb = document.createElement("button");
          pb.className = "wrtc-hdr-pr"; pb.title = "Probe"; pb.setAttribute("aria-label", "Probe");
          pb.innerHTML = PROBE_SVG;
          pb.addEventListener("click", function (e) { e.stopPropagation(); openProbe(c.probe); });   // не триггерит скриншот
          top.appendChild(pb);
        }
      }
      // тап по превью -> живой поток
      var w = el.querySelector(".wrtc");
      if (w && (w.dataset.hd || w.dataset.sd)) {
        w.addEventListener("click", function () { openLive(w.dataset.hd, w.dataset.sd, w.dataset.snap, w.dataset.probe); });
      }
    }
  });
})();
