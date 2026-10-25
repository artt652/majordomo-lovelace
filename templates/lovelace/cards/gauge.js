/* ============================================================================
 * Пример ВНЕШНЕЙ карточки: круговой индикатор (gauge) для числового свойства.
 * Положить в  cards/gauge.js  и добавить "gauge.js" в cards/index.json.
 * Ядро панели и API НЕ меняются — карточка подключается сама.
 *
 * Контракт плагина (window.Lovelace.register(type, spec)):
 *   fields  : поля для UI-редактора  [{k,l,t,o}]   (t: text|num|select|prop)
 *   reads   : какие свойства читать   -> API вернёт их в ctrl.values[prop]
 *   writes  : какие свойства писать   (не нужно для индикатора)
 *   methods : какие методы разрешить  (не нужно)
 *   render(dev, ctrl, ctx) -> HTML-строка. ctx: {esc, svg, truthy, normHex}
 *   bind(el, dev, ctrl, api)          (не нужен — только отображение)
 * ==========================================================================*/
(function () {
  if (!window.Lovelace) return;

  // свои стили — карточка самодостаточна
  var st = document.createElement("style");
  st.textContent =
    ".gg{position:relative;display:grid;place-items:center;padding:6px 0}" +
    ".gg svg{width:96px;height:96px;transform:rotate(-90deg)}" +
    ".gg .bg{fill:none;stroke:var(--raised,#222736);stroke-width:9}" +
    ".gg .fg{fill:none;stroke:var(--active,#ffb454);stroke-width:9;stroke-linecap:round;transition:stroke-dashoffset .4s}" +
    ".gg .lab{position:absolute;text-align:center}" +
    ".gg .lab b{font-family:ui-monospace,monospace;font-size:20px;font-weight:600;display:block}" +
    ".gg .lab span{font-size:11px;color:var(--muted,#8b93a7)}";
  document.head.appendChild(st);

  window.Lovelace.register("gauge", {
    fields: [
      { k: "prop", l: "Свойство", t: "prop" },
      { k: "unit", l: "Ед.",      t: "text" },
      { k: "min",  l: "min",      t: "num"  },
      { k: "max",  l: "max",      t: "num"  }
    ],
    // читаем одно свойство; API вернёт его в ctrl.values[prop]
    reads: function (c) { return c.prop ? [c.prop] : []; },

    render: function (dev, c, ctx) {
      var raw = (c.values && c.prop) ? c.values[c.prop] : null;
      var v = parseFloat(raw); if (isNaN(v)) v = 0;
      var min = (c.min != null ? +c.min : 0);
      var max = (c.max != null ? +c.max : 100);
      var pct = Math.max(0, Math.min(100, ((v - min) / ((max - min) || 1)) * 100));
      var R = 40, C = 2 * Math.PI * R;
      var off = C * (1 - pct / 100);
      return '<div class="gg"><svg viewBox="0 0 96 96">' +
        '<circle class="bg" cx="48" cy="48" r="' + R + '"/>' +
        '<circle class="fg" cx="48" cy="48" r="' + R + '" stroke-dasharray="' + C +
          '" stroke-dashoffset="' + off + '"/></svg>' +
        '<div class="lab"><b>' + ctx.esc(raw == null ? "—" : raw) + '</b>' +
        '<span>' + ctx.esc(c.unit || "") + '</span></div></div>';
    },
    bind: function (el, dev, c, api) {
      if (!api.openChart || !c.prop) return;
      el.style.cursor = "pointer";
      el.addEventListener("click", function () {
        api.openChart(dev.id + "." + c.prop, (dev.title || dev.id) + " · " + c.prop);
      });
    }
  });
})();
