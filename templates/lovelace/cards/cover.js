/* cover — штора (вызывает методы) */
(function () {
  var L = window.Lovelace; if (!L) return;
  L.util.css(".cover{display:flex;flex-direction:column;gap:8px}.cover-state{font-size:12px;color:var(--muted);min-height:14px}.cover-btns{display:flex;gap:6px}.cbtn{flex:1;height:38px;border-radius:10px;border:1px solid var(--border);background:var(--raised);color:var(--text);font-size:14px;cursor:pointer}.cbtn:hover{border-color:var(--faint)}.cbtn:active{transform:scale(.96)}.cbtn:disabled{opacity:.5}");
  var V = L.util.V;
  function coverMethods(c){
    return {open:c.m_open||(c.actions&&c.actions.open&&c.actions.open.method),
            stop:c.m_stop||(c.actions&&c.actions.stop&&c.actions.stop.method),
            close:c.m_close||(c.actions&&c.actions.close&&c.actions.close.method)};
  }
  L.register("cover", {
    fields:[{k:"state",l:"Состояние (свойство)",t:"prop"},{k:"m_open",l:"Метод «открыть»",t:"text"},{k:"m_stop",l:"Метод «стоп»",t:"text"},{k:"m_close",l:"Метод «закрыть»",t:"text"}],
    reads:function(c){return c.state?[c.state]:[];},
    methods:function(c){var m=coverMethods(c),o=[];["open","stop","close"].forEach(function(k){if(m[k])o.push(m[k]);});return o;},
    render:function(dev,c,ctx){
      var st=V(c,c.state,c.state_value); if(st==null)st="";
      var m=coverMethods(c), b="";
      if(m.open) b+='<button class="cbtn" data-m="'+ctx.esc(m.open)+'" title="Открыть">▲</button>';
      if(m.stop) b+='<button class="cbtn" data-m="'+ctx.esc(m.stop)+'" title="Стоп">■</button>';
      if(m.close)b+='<button class="cbtn" data-m="'+ctx.esc(m.close)+'" title="Закрыть">▼</button>';
      return '<div class="cover"><div class="cover-state">'+ctx.esc(st)+'</div><div class="cover-btns">'+b+'</div></div>';
    },
    bind:function(el,dev,c,api){
      el.querySelectorAll(".cbtn").forEach(function(btn){
        btn.addEventListener("click",function(){var m=btn.dataset.m;if(!m)return;btn.disabled=true;
          api.postMethod(dev.id,m).then(function(){btn.disabled=false;}).catch(function(){btn.disabled=false;api.flash("Ошибка "+dev.id+"."+m);});});
      });
    }
  });
})();
