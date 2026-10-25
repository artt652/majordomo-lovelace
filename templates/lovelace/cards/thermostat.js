/* thermostat — текущая + цель (ПИШЕТ цель), график по тапу на текущую */
(function () {
  var L = window.Lovelace; if (!L) return;
  L.util.css(".thermo{display:flex;flex-direction:column;gap:10px}.thermo-cur{display:flex;align-items:baseline;gap:4px}.thermo-cur.tappable{cursor:pointer}.thermo-cur .spark{width:15px;height:15px;color:var(--faint);margin-left:auto;align-self:center;flex:none;transition:.15s}.thermo-cur.tappable:hover .spark,.thermo-cur.tappable:active .spark{color:var(--active)}.thermo-cur .v{font-family:var(--mono);font-size:24px;font-weight:600}.thermo-cur .u{font-size:12px;color:var(--muted)}.thermo-set{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--raised);border:1px solid var(--border);border-radius:12px;padding:6px}.tbtn{width:40px;height:34px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:20px;line-height:1;cursor:pointer}.tbtn:active{transform:scale(.94)}.thermo-tgt{font-family:var(--mono);font-size:16px;font-weight:600;color:var(--active)}");
  var V = L.util.V;
  L.register("thermostat", {
    fields:[{k:"current",l:"Текущая (свойство)",t:"prop"},{k:"target",l:"Цель (свойство)",t:"prop"},{k:"unit",l:"Ед.",t:"text"},{k:"min",l:"min",t:"num"},{k:"max",l:"max",t:"num"},{k:"step",l:"шаг",t:"num"}],
    reads:function(c){var r=[];if(c.current)r.push(c.current);if(c.target)r.push(c.target);return r;},
    writes:function(c){return c.target?[c.target]:[];},
    render:function(dev,c,ctx){
      var cv=V(c,c.current,c.current_value), tv=V(c,c.target,c.target_value);
      var cur=(cv==null||cv==="")?"—":cv, tgt=(tv==null||tv==="")?0:(0+parseFloat(tv)), u=c.unit||"";
      var sp=c.current?'<svg class="spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-6 4 4 6-8"/></svg>':'';
      return '<div class="thermo"><div class="thermo-cur'+(c.current?' tappable':'')+'"><span class="v">'+ctx.esc(cur)+'</span><span class="u">'+ctx.esc(u)+'</span>'+sp+'</div>'
        +'<div class="thermo-set" data-min="'+(c.min!=null?c.min:5)+'" data-max="'+(c.max!=null?c.max:35)+'" data-step="'+(c.step||0.5)+'">'
        +'<button class="tbtn" data-d="-1">−</button><span class="thermo-tgt">'+ctx.esc(tgt)+ctx.esc(u)+'</span><button class="tbtn" data-d="1">+</button></div></div>';
    },
    bind:function(el,dev,c,api){
      var setEl=el.querySelector(".thermo-set");
      if(setEl&&c.target){
        var min=parseFloat(setEl.dataset.min),max=parseFloat(setEl.dataset.max),step=parseFloat(setEl.dataset.step)||0.5;
        var out=setEl.querySelector(".thermo-tgt"), unit=(out.textContent.replace(/[\d.\-]/g,""))||"", t=null;
        setEl.querySelectorAll(".tbtn").forEach(function(btn){
          btn.addEventListener("click",function(){
            var cur=parseFloat(out.textContent); if(isNaN(cur))cur=min;
            var nv=cur+(parseInt(btn.dataset.d,10)*step); nv=Math.min(max,Math.max(min,Math.round(nv*100)/100));
            out.textContent=nv+unit;
            clearTimeout(t);t=setTimeout(function(){api.postSet(dev.id,c.target,nv).catch(function(){api.flash("Не удалось задать «"+dev.id+"»");});},350);
          });
        });
      }
      var cur=el.querySelector(".thermo-cur");
      if(cur && api.openChart && c.current){
        cur.style.cursor="pointer";
        cur.addEventListener("click",function(){ api.openChart(dev.id+"."+c.current, (dev.title||dev.id)+" · "+c.current); });
      }
    }
  });
})();
