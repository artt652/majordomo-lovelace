/* ============================================================================
 * ВНЕШНЯЯ карточка: погода (под модуль Яндекс-погоды Majordomo).
 * Положить в  htdocs/tools/cards/weather.js  и добавить "weather.js" в cards/index.json.
 * Ядро панели и API НЕ меняются.
 *
 * Zero-config: в редакторе просто выбери объект погоды. Карточка читает
 * стандартные свойства (см. PROPS ниже); чего нет — то не показывает.
 * Иконку выбирает по коду `icon` (clear-night, rain, ...), fallback по `icon_text`.
 * Тап по карточке — график температуры.
 * ==========================================================================*/
(function () {
  if (!window.Lovelace) return;
  var L = window.Lovelace;

  // стандартные имена свойств модуля погоды
  var P = {
    town: "name_town", icon: "icon", cond: "icon_text",
    temp: "temperature", feels: "temp_feels", water: "temp_water",
    pressure: "pressure_mm", windSpeed: "wind_speed", windDir: "wind_direction_text",
    precip: "precipitation_probability", uv: "uv_text",
    sunrise: "sunrise", sunset: "sunset", moon: "moon_phase_text",
    geo: "geomagnetic_text", visibility: "roadway_visibility_description"
  };
  var READS = [];
  for (var k in P) READS.push(P[k]);

  var st = document.createElement("style");
  st.textContent =
    ".wz{display:flex;flex-direction:column;gap:12px}" +
    ".wz-head{position:relative;display:flex;align-items:flex-start;gap:12px}" +
    ".wz-ico{color:var(--active);flex:none}" +
    ".wz-ico svg{width:52px;height:52px}" +
    ".wz-t{flex:1;min-width:0}" +
    ".wz-temp{font-family:var(--mono);font-size:32px;font-weight:600;letter-spacing:-1px;line-height:1;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}" +
    ".wz-temp small{font-family:var(--sans);font-size:13px;font-weight:500;color:var(--muted);letter-spacing:0}" +
    ".wz-feels{font-size:12px;color:var(--muted);margin-top:5px}" +
    ".wz-town{position:absolute;top:0;right:0;font-size:12px;color:var(--faint);max-width:55%;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".wz-grid{display:flex;flex-wrap:wrap;gap:8px}" +
    ".wz-chip{display:inline-flex;align-items:baseline;gap:8px;background:var(--raised);border:1px solid var(--border);border-radius:10px;padding:8px 10px;color:var(--text);font-size:12.5px;white-space:nowrap}" +
    ".wz-chip .wz-k{color:var(--muted)}" +
    ".wz-chip .wz-v{}" +
    ".wz-note{font-size:12px;color:var(--muted);line-height:1.45;border-top:1px solid var(--border);padding-top:8px}";
  document.head.appendChild(st);

  var ICO = {
    sun:'<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
    moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    cloud:'<path d="M7 18a4.5 4.5 0 1 1 .9-8.9A5.5 5.5 0 0 1 18 11a3.5 3.5 0 0 1-.5 7H7z"/>',
    cloudsun:'<circle cx="7.5" cy="7" r="2.8"/><path d="M7.5 1.7v1.3M2.7 7H1.4M11.3 3.2l-.9.9M3.7 4.1l.9.9"/><path d="M9 19a4 4 0 0 1 .5-8 4.8 4.8 0 0 1 9 1.3A3 3 0 0 1 18 19H9z"/>',
    cloudmoon:'<path d="M16.5 5.5a3.2 3.2 0 1 1-3.6-3.2 2.4 2.4 0 0 0 3.6 3.2z"/><path d="M7 19a4 4 0 0 1 .5-8 4.8 4.8 0 0 1 9 1.3A3 3 0 0 1 16 19H7z"/>',
    rain:'<path d="M7 15a4.5 4.5 0 1 1 .9-8.9A5.5 5.5 0 0 1 18 8a3.5 3.5 0 0 1-.5 7H7z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    snow:'<path d="M7 15a4.5 4.5 0 1 1 .9-8.9A5.5 5.5 0 0 1 18 8a3.5 3.5 0 0 1-.5 7H7z"/><path d="M9 19h.01M13 19h.01M11 21h.01M15 21h.01"/>',
    storm:'<path d="M7 14a4.5 4.5 0 1 1 .9-8.9A5.5 5.5 0 0 1 18 7a3.5 3.5 0 0 1-.5 7H7z"/><path d="M12 14l-2 4h3l-2 4"/>',
    fog:'<path d="M7 12a4.5 4.5 0 1 1 .9-8.9A5.5 5.5 0 0 1 18 5a3.5 3.5 0 0 1-.5 7"/><path d="M4 16h16M6 20h12"/>',
    wind:'<path d="M3 8h10a2 2 0 1 0-2-2M3 12h15a2 2 0 1 1-2 2M3 16h8a2 2 0 1 1-2 2"/>'
  };
  function wIcon(code, text) {
    var c = String(code || "").toLowerCase();
    if (/thunder|storm/.test(c)) return "storm";
    if (/snow|sleet|hail/.test(c)) return "snow";
    if (/rain|drizzle/.test(c)) return "rain";
    if (/fog|mist|haze/.test(c)) return "fog";
    if (/wind/.test(c)) return "wind";
    if (/(partly-cloudy|partly).*night/.test(c)) return "cloudmoon";
    if (/partly-cloudy|partly/.test(c)) return "cloudsun";
    if (/overcast|cloudy|cloud/.test(c)) return "cloud";
    if (/night/.test(c)) return "moon";
    if (/clear|sunny|day/.test(c)) return "sun";
    var t = String(text || "").toLowerCase();
    if (/гроз|молни/.test(t)) return "storm";
    if (/снег/.test(t)) return "snow";
    if (/дожд|ливень|морос/.test(t)) return "rain";
    if (/туман|мгла|дымк/.test(t)) return "fog";
    if (/перемен|малооблач/.test(t)) return "cloudsun";
    if (/облачн|пасмурн/.test(t)) return "cloud";
    if (/ясн|солн/.test(t)) return "sun";
    return "cloudsun";
  }

  function V(c, prop) {
    return (c.values && Object.prototype.hasOwnProperty.call(c.values, prop)) ? c.values[prop] : undefined;
  }
  function has(v) { return v != null && v !== "" && v !== "—" && v !== "-"; }
  function hhmm(v) { v = String(v || ""); var m = v.match(/(\d{1,2}:\d{2})/); return m ? m[1] : v; }

  L.register("weather", {
    fields: [
      { k: "hide", l: "Скрыть", t: "multi", o: [
        { v: "feels", l: "Ощущается" }, { v: "town", l: "Город" },
        { v: "wind", l: "Ветер" }, { v: "pressure", l: "Давление" }, { v: "precip", l: "Осадки" },
        { v: "uv", l: "УФ" }, { v: "sun", l: "Солнце" }, { v: "moon", l: "Луна" }, { v: "geo", l: "Магн." },
        { v: "water", l: "Вода" }, { v: "visibility", l: "Видимость" }
      ] }
    ],
    reads: function () { return READS; },
    render: function (dev, c, ctx) {
      var g = function (key) { return V(c, P[key]); };
      var hidden = c.hide ? String(c.hide).split(",") : [];
      var show = function (key) { return hidden.indexOf(key) < 0; };
      var temp = g("temp"), cond = g("cond"), town = g("town");
      var icon = ICO[wIcon(g("icon"), cond)] || ICO.cloudsun;

      var h = '<div class="wz"><div class="wz-head">' +
        '<span class="wz-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg></span>' +
        '<div class="wz-t"><div class="wz-temp">' + ctx.esc(has(temp) ? temp + "\u00B0" : "\u2014") +
        (has(cond) ? '<small>' + ctx.esc(cond) + '</small>' : '') + '</div>' +
        (show("feels") && has(g("feels")) ? '<div class="wz-feels">ощущается ' + ctx.esc(g("feels")) + '\u00B0</div>' : '') + '</div>' +
        (show("town") && has(town) ? '<div class="wz-town">' + ctx.esc(town) + '</div>' : '') +
        '</div>';

      var chips = [];
      function chip(key, label, val) { if (show(key) && has(val)) chips.push('<div class="wz-chip"><span class="wz-k">' + ctx.esc(label) + '</span><span class="wz-v">' + ctx.esc(val) + '</span></div>'); }
      var ws = g("windSpeed"), wd = g("windDir");
      var wind = has(wd) ? (has(ws) && String(ws) !== "0" ? wd + ", " + ws + " м/с" : wd) : (has(ws) ? ws + " м/с" : "");
      chip("wind", "Ветер", wind);
      if (has(g("pressure"))) chip("pressure", "Давление", g("pressure") + " мм");
      if (has(g("precip"))) chip("precip", "Осадки", g("precip") + "%");
      chip("uv", "УФ", g("uv"));
      if (has(g("sunrise")) || has(g("sunset"))) chip("sun", "Солнце", hhmm(g("sunrise")) + " – " + hhmm(g("sunset")));
      chip("moon", "Луна", g("moon"));
      chip("geo", "Магн.", g("geo"));
      if (has(g("water"))) chip("water", "Вода", g("water") + "\u00B0");
      if (chips.length) h += '<div class="wz-grid">' + chips.join("") + '</div>';

      if (show("visibility") && has(g("visibility"))) h += '<div class="wz-note">' + ctx.esc(g("visibility")) + '</div>';
      return h + '</div>';
    },
    bind: function (el, dev, c, api) {
      var w = el.querySelector(".wz");
      if (w && api.openChart) {
        w.style.cursor = "pointer";
        w.addEventListener("click", function () { api.openChart(dev.id + "." + P.temp, (dev.title || dev.id) + " · температура"); });
      }
    }
  });
})();
