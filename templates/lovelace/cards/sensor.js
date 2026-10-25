/* sensor — значение + график по тапу */
(function () {
  var L = window.Lovelace; if (!L) return;
  L.util.css(".sensor{display:flex;align-items:baseline;gap:5px}.sensor.tappable{cursor:pointer;-webkit-tap-highlight-color:transparent}.sensor .spark{width:15px;height:15px;color:var(--faint);margin-left:auto;align-self:center;flex:none;transition:.15s}.sensor.tappable:hover .spark,.sensor.tappable:active .spark{color:var(--active)}.sensor .v{font-family:var(--mono);font-size:26px;font-weight:600;letter-spacing:-.5px}.sensor .u{font-size:13px;color:var(--muted)}");
  var V = L.util.V;
  L.register("sensor", {
    fields:[{k:"prop",l:"Свойство",t:"prop"},{k:"unit",l:"Ед.",t:"text"}],
    reads:function(c){return c.prop?[c.prop]:[];},
    render:function(dev,c,ctx){
      var v=V(c,c.prop);
      return '<div class="sensor tappable" role="button" tabindex="0" data-chart="'+ctx.esc(dev.id+"."+c.prop)+'" data-title="'+ctx.esc((dev.title||dev.id)+" · "+c.prop)+'">'
        +'<span class="v">'+ctx.esc(v==null?"—":v)+'</span><span class="u">'+ctx.esc(c.unit||"")+'</span>'
        +'<svg class="spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-6 4 4 6-8"/></svg></div>';
    },
    bind:function(el,dev,c,api){
      var s=el.querySelector(".sensor"); if(!s||!api.openChart) return;
      function open(){api.openChart(s.dataset.chart, s.dataset.title);}
      s.addEventListener("click",open);
      s.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});
    }
  });
})();
