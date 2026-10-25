/* text — текстовое значение */
(function () {
  var L = window.Lovelace; if (!L) return;
  L.util.css(".textv{font-size:14px;color:var(--text);word-break:break-word}");
  var V = L.util.V;
  L.register("text", {
    fields:[{k:"prop",l:"Свойство",t:"prop"},{k:"unit",l:"Ед.",t:"text"}],
    reads:function(c){return c.prop?[c.prop]:[];},
    render:function(dev,c,ctx){var v=V(c,c.prop);return '<div class="textv">'+ctx.esc(v==null?"":v)+ctx.esc(c.unit?" "+c.unit:"")+'</div>';}
  });
})();
