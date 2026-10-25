/* rgb — питание + цвет (ПИШЕТ оба) */
(function () {
  var L = window.Lovelace; if (!L) return;
  L.util.css(".rgb{display:flex;flex-direction:column;gap:10px}.rgb-color{display:block;width:100%;height:34px;border-radius:10px;border:1px solid var(--border);background:var(--sw,#333);cursor:pointer;padding:0}.rgb-color:active{transform:scale(.98)}.sw{--w:52px;position:relative;width:var(--w);height:29px;flex:none;cursor:pointer;background:var(--raised);border:1px solid var(--border);border-radius:20px;transition:.18s}.sw::after{content:'';position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:var(--faint);transition:.18s}.sw[aria-checked='true']{background:var(--active-soft);border-color:#5a4a28}.sw[aria-checked='true']::after{left:calc(var(--w) - 24px);background:var(--active)}.sw.busy{opacity:.55;pointer-events:none}.sw-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.sw-state{font-size:13px;color:var(--muted)}.card.on .sw-state{color:var(--active)}.rgb-cct{-webkit-appearance:none;appearance:none;width:100%;height:14px;border-radius:8px;background:linear-gradient(to right,#ff9838,#ffd9a8,#fff,#cfe0ff,#a9c6ff);outline:none;cursor:pointer;margin:2px 0}.rgb-cct::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#fff;border:2px solid #888;box-shadow:0 1px 3px rgba(0,0,0,.4);cursor:pointer}.rgb-cct::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid #888;cursor:pointer}.rgb-cct-row{display:flex;align-items:center;gap:8px}.rgb-cct-row .lab{font-size:11px;color:var(--muted);flex:none;font-family:var(--mono)}");
  var V = L.util.V, tru = L.util.tru;
  // ---- цветовые преобразования (самодостаточно) ----
  function hxToRgb(h){h=String(h||"").replace("#","");if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];var n=parseInt(h,16);if(isNaN(n))n=0xffaa33;return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};}
  function rgbToHsv(r,g,b){r/=255;g/=255;b/=255;var mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}return {h:h,s:mx?d/mx:0,v:mx};}
  function hsvToRgb(h,s,v){h=((h%360)+360)%360;var c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,r=0,g=0,b=0;if(h<60){r=c;g=x;}else if(h<120){r=x;g=c;}else if(h<180){g=c;b=x;}else if(h<240){g=x;b=c;}else if(h<300){r=x;b=c;}else{r=c;b=x;}return {r:(r+m)*255,g:(g+m)*255,b:(b+m)*255};}
  function xx(v){v=Math.max(0,Math.min(255,Math.round(v)));return ("0"+v.toString(16)).slice(-2);}
  function p4(n){n=Math.max(0,Math.round(n)).toString(16).toUpperCase();while(n.length<4)n="0"+n;return n;}
  // Tuya HSV: HHHHSSSSVVVV (H 0-360, S/V 0-1000). Яркость V — из выбранного цвета (пикера).
  function hexToTuya(hex){var g=hxToRgb(hex),h=rgbToHsv(g.r,g.g,g.b);return p4(h.h)+p4(h.s*1000)+p4(h.v*1000);}
  function tuyaToHex(s){s=String(s||"").replace(/[^0-9a-fA-F]/g,"");if(s.length<12)return null;var H=parseInt(s.slice(0,4),16),S=parseInt(s.slice(4,8),16)/1000,Vv=parseInt(s.slice(8,12),16)/1000;var g=hsvToRgb(H,S,Vv);return "#"+xx(g.r)+xx(g.g)+xx(g.b);}
  function colToHex(raw,c,ctx){ if(c.colorfmt==="hsv1000"){ return tuyaToHex(raw)||"#ffaa33"; } return ctx.normHex(raw)||"#ffaa33"; }
  function hexToStore(hex,c){ return (c.colorfmt==="hsv1000") ? hexToTuya(hex) : hex; }

  L.register("rgb", {
    fields:[{k:"power",l:"Питание (свойство)",t:"prop"},{k:"color",l:"Цвет (свойство)",t:"prop"},{k:"colorfmt",l:"Формат цвета",t:"select",o:["hex","hsv1000"]},{k:"temperature",l:"Температура белого (свойство)",t:"prop"},{k:"temp_min",l:"Темп. min",t:"num"},{k:"temp_max",l:"Темп. max",t:"num"},{k:"temp_step",l:"Темп. шаг",t:"num"}],
    reads:function(c){var r=[];if(c.power)r.push(c.power);if(c.color)r.push(c.color);if(c.temperature)r.push(c.temperature);return r;},
    writes:function(c){var w=[];if(c.power)w.push(c.power);if(c.color)w.push(c.color);if(c.temperature)w.push(c.temperature);return w;},
    isOn:function(c){return tru(V(c,c.power,c.power_value));},
    render:function(dev,c,ctx){
      var on=tru(V(c,c.power,c.power_value));
      var col=colToHex(V(c,c.color,c.color_value),c,ctx);
      return '<div class="rgb"><div class="sw-row"><span class="sw-state">'+(on?"Включено":"Выключено")+'</span>'
        +'<div class="sw" role="switch" tabindex="0" aria-checked="'+on+'"></div></div>'
        +'<button class="rgb-color" style="--sw:'+ctx.esc(col)+'" data-rgbcolor data-color="'+ctx.esc(col)+'" aria-label="Выбрать цвет"></button>'+(c.temperature?('<div class="rgb-cct-row"><span class="lab">CCT</span>'+'<input type="range" class="rgb-cct" min="'+(c.temp_min!=null?c.temp_min:2700)+'" max="'+(c.temp_max!=null?c.temp_max:6500)+'" step="'+(c.temp_step||50)+'" value="'+ctx.esc((function(){var t=V(c,c.temperature);return (t==null||t==='')?4000:t;})())+'"></div>'):'')+'</div>';
    },
    bind:function(el,dev,c,api){
      var sw=el.querySelector(".sw"), state=el.querySelector(".sw-state"), card=el.closest(".card");
      if(sw){
        function tg(){var cur=sw.getAttribute("aria-checked")==="true", next=!cur;
          sw.setAttribute("aria-checked",next); state.textContent=next?"Включено":"Выключено"; if(card)card.classList.toggle("on",next);
          api.postSet(dev.id,c.power,next?1:0).catch(function(){sw.setAttribute("aria-checked",cur);
            state.textContent=cur?"Включено":"Выключено"; if(card)card.classList.toggle("on",cur); api.flash("Не удалось «"+dev.id+"»");});}
        sw.addEventListener("click",tg);
        sw.addEventListener("keydown",function(e){if(e.key===" "||e.key==="Enter"){e.preventDefault();tg();}});
      }
      var swatch=el.querySelector("[data-rgbcolor]");
      if(swatch && api.openColor){
        swatch.addEventListener("click",function(){
          api.openColor(swatch.dataset.color||"#ffaa33", function(hex){
            swatch.dataset.color=hex; swatch.style.setProperty("--sw",hex);
            api.postSet(dev.id,c.color,hexToStore(hex,c)).catch(function(){api.flash("Не удалось задать цвет «"+dev.id+"»");});
          });
        });
      }
      var cct=el.querySelector(".rgb-cct");
      if(cct && c.temperature){
        var tt=null;
        cct.addEventListener("input",function(){ clearTimeout(tt); tt=setTimeout(function(){
          api.postSet(dev.id,c.temperature,cct.value).catch(function(){ api.flash("Не удалось задать температуру «"+dev.id+"»"); });
        },200); });
      }
    }
  });
})();
