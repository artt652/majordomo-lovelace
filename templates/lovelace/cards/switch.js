/* switch — тумблер (ПИШЕТ) */
(function () {
  var L = window.Lovelace; if (!L) return;
  L.util.css(".sw{--w:52px;position:relative;width:var(--w);height:29px;flex:none;cursor:pointer;background:var(--raised);border:1px solid var(--border);border-radius:20px;transition:.18s}.sw::after{content:'';position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:var(--faint);transition:.18s}.sw[aria-checked='true']{background:var(--active-soft);border-color:#5a4a28}.sw[aria-checked='true']::after{left:calc(var(--w) - 24px);background:var(--active)}.sw.busy{opacity:.55;pointer-events:none}.sw-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.sw-state{font-size:13px;color:var(--muted)}.card.on .sw-state{color:var(--active)}");
  var V = L.util.V, tru = L.util.tru;
  L.register("switch", {
    fields:[{k:"prop",l:"Свойство",t:"prop"}],
    reads:function(c){return c.prop?[c.prop]:[];},
    writes:function(c){return c.prop?[c.prop]:[];},
    isOn:function(c){return tru(V(c,c.prop));},
    render:function(dev,c,ctx){
      var on=tru(V(c,c.prop));
      return '<div class="sw-row"><span class="sw-state">'+(on?"Включено":"Выключено")+'</span>'
        +'<div class="sw" role="switch" tabindex="0" aria-checked="'+on+'"></div></div>';
    },
    bind:function(el,dev,c,api){
      var sw=el.querySelector(".sw"), state=el.querySelector(".sw-state"), card=el.closest(".card");
      if(!sw) return;
      function toggle(){
        if(sw.classList.contains("busy"))return;
        var cur=sw.getAttribute("aria-checked")==="true", next=!cur;
        sw.setAttribute("aria-checked",next); state.textContent=next?"Включено":"Выключено";
        if(card)card.classList.toggle("on",next);
        sw.classList.add("busy");
        api.postSet(dev.id,c.prop,next?1:0).then(function(){sw.classList.remove("busy");})
          .catch(function(){sw.classList.remove("busy"); sw.setAttribute("aria-checked",cur);
            state.textContent=cur?"Включено":"Выключено"; if(card)card.classList.toggle("on",cur);
            api.flash("Не удалось изменить «"+dev.id+"»");});
      }
      sw.addEventListener("click",toggle);
      sw.addEventListener("keydown",function(e){if(e.key===" "||e.key==="Enter"){e.preventDefault();toggle();}});
    }
  });
})();
