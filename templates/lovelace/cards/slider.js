/* slider — ползунок (ПИШЕТ) */
(function () {
  var L = window.Lovelace; if (!L) return;
  L.util.css(".slider-val{font-family:var(--mono);font-size:13px;color:var(--text);float:right}input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:6px;margin:6px 0 2px;border-radius:6px;background:var(--raised);outline:none;cursor:pointer}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:var(--active);border:3px solid var(--surface);cursor:pointer;box-shadow:0 0 0 1px var(--border)}input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:var(--active);border:3px solid var(--surface);cursor:pointer}");
  var V = L.util.V;
  L.register("slider", {
    fields:[{k:"prop",l:"Свойство",t:"prop"},{k:"unit",l:"Ед.",t:"text"},{k:"min",l:"min",t:"num"},{k:"max",l:"max",t:"num"},{k:"step",l:"шаг",t:"num"}],
    reads:function(c){return c.prop?[c.prop]:[];},
    writes:function(c){return c.prop?[c.prop]:[];},
    render:function(dev,c,ctx){
      var v=V(c,c.prop); if(v==null)v=0;
      return '<span class="slider-val">'+ctx.esc(v)+ctx.esc(c.unit||"")+'</span>'
        +'<input type="range" min="'+(c.min||0)+'" max="'+(c.max!=null?c.max:100)+'" step="'+(c.step||1)+'" value="'+ctx.esc(v)+'"'+(c.readonly?" disabled":"")+'>';
    },
    bind:function(el,dev,c,api){
      var inp=el.querySelector("input[type=range]"), out=el.querySelector(".slider-val");
      if(!inp) return;
      var unit=(out&&out.textContent.replace(/[\d.\-]/g,""))||"", t=null;
      inp.addEventListener("input",function(){if(out)out.textContent=inp.value+unit;});
      inp.addEventListener("change",function(){clearTimeout(t);t=setTimeout(function(){
        api.postSet(dev.id,c.prop,inp.value).catch(function(){api.flash("Не удалось задать «"+dev.id+"»");});},120);});
    }
  });
})();
