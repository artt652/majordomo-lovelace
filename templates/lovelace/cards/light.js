/* ============================================================================
 * ВНЕШНЯЯ карточка: light — универсальная лампа (Tuya RGBCCT и проще).
 * Показываются ТОЛЬКО контролы для явно заданных свойств.
 * Цветная лампа: на главной питание + «Настроить» -> ядерный пикер (колесо)
 *   со вкладкой «Белый» (яркость+температура). Одно окно.
 * Бело-только лампа: слайдеры яркости/температуры прямо на карточке.
 * Формат цвета настраивается (hex/rgb/hsv/hsv1000/tuya_v1/xy).
 * ==========================================================================*/
(function () {
  var L = window.Lovelace; if (!L) return;
  var V = L.util.V, tru = L.util.tru;

  L.util.css(
    ".lt{display:flex;flex-direction:column;gap:10px}" +
    ".sw{--w:52px;position:relative;width:var(--w);height:29px;flex:none;cursor:pointer;background:var(--raised);border:1px solid var(--border);border-radius:20px;transition:.18s}" +
    ".sw::after{content:'';position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:var(--faint);transition:.18s}" +
    ".sw[aria-checked='true']{background:var(--active-soft);border-color:#5a4a28}" +
    ".sw[aria-checked='true']::after{left:calc(var(--w) - 24px);background:var(--active)}" +
    ".sw-row{display:flex;align-items:center;justify-content:space-between;gap:10px}" +
    ".sw-state{font-size:13px;color:var(--muted)}.card.on .sw-state{color:var(--active)}" +
    ".lt-mode{width:10px;height:10px;border-radius:50%;flex:none;border:1px solid var(--border);align-self:flex-start;margin-top:3px}" +
    ".lt-mode.colour{background:conic-gradient(from 0deg,#ff4d4d,#ffd24d,#4dff88,#4dd2ff,#4d6bff,#d24dff,#ff4d4d)}" +
    ".lt-tap{display:flex;align-items:center;justify-content:flex-end;color:var(--faint);font-size:18px;line-height:1;min-height:10px}" +
    // подсветка цветом лампы: ТОЛЬКО иконка + периметр/свечение (тумблер и текст не трогаем)
    ".card.lt-glow.on{border-color:var(--lt-color-b);box-shadow:inset 0 0 0 1px var(--lt-color-soft), 0 0 22px -12px var(--lt-color)}" +
    ".card.lt-glow.on::before{background:radial-gradient(120px 60px at 22px 22px,var(--lt-color-soft),transparent 70%)}" +
    ".card.lt-glow.on .ico{background:var(--lt-color-soft);color:var(--lt-color)}" +
    ".lt-slider{display:flex;flex-direction:column;gap:5px}" +
    ".lt-slider .lab{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);font-family:var(--mono)}" +
    ".lt-rng{-webkit-appearance:none;appearance:none;width:100%;height:12px;border-radius:8px;background:var(--raised);outline:none;cursor:pointer}" +
    ".lt-rng::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:var(--active);border:3px solid var(--surface);box-shadow:0 0 0 1px var(--border);cursor:pointer}" +
    ".lt-rng::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--active);border:3px solid var(--surface);cursor:pointer}" +
    ".lt-cct{background:linear-gradient(to right,#ff9838,#ffd9a8,#fff,#cfe0ff,#a9c6ff)}" +
    ".lt-cct::-webkit-slider-thumb{background:#fff;border:2px solid #888}" +
    ".lt-cct::-moz-range-thumb{background:#fff;border:2px solid #888}"
  );

  // ---- цвет: hex <-> форматы ----
  function hxToRgb(h){h=String(h||"").replace("#","");if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];var n=parseInt(h,16);if(isNaN(n))n=0xffaa33;return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};}
  function rgbToHsv(r,g,b){r/=255;g/=255;b/=255;var mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}return {h:h,s:mx?d/mx:0,v:mx};}
  function hsvToRgb(h,s,v){h=((h%360)+360)%360;var c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,r=0,g=0,b=0;if(h<60){r=c;g=x;}else if(h<120){r=x;g=c;}else if(h<180){g=c;b=x;}else if(h<240){g=x;b=c;}else if(h<300){r=x;b=c;}else{r=c;b=x;}return {r:(r+m)*255,g:(g+m)*255,b:(b+m)*255};}
  function xx(v){v=Math.max(0,Math.min(255,Math.round(v)));return ("0"+v.toString(16)).slice(-2);}
  function p2(n){n=Math.max(0,Math.min(255,Math.round(n))).toString(16).toUpperCase();return n.length<2?("0"+n):n;}
  function p3(n){n=Math.max(0,Math.round(n)).toString(16).toUpperCase();while(n.length<3)n="0"+n;return n;}
  function p4(n){n=Math.max(0,Math.round(n)).toString(16).toUpperCase();while(n.length<4)n="0"+n;return n;}
  function normHexLoose(v){v=String(v||"").trim();var m=v.match(/#?([0-9a-fA-F]{6})/);return m?("#"+m[1]):"#ffaa33";}
  function r4(v){return Math.round(v*10000)/10000;}
  function xyToHex(x,y){if(!y)y=1e-4;var Y=1,X=(x/y)*Y,Z=((1-x-y)/y)*Y;var r=X*3.2406+Y*-1.5372+Z*-0.4986,g=X*-0.9689+Y*1.8758+Z*0.0415,b=X*0.0557+Y*-0.2040+Z*1.0570;var mx=Math.max(r,g,b,1);r/=mx;g/=mx;b/=mx;function ga(u){u=u<0?0:u;return u<=0.0031308?12.92*u:1.055*Math.pow(u,1/2.4)-0.055;}return "#"+xx(ga(r)*255)+xx(ga(g)*255)+xx(ga(b)*255);}
  function hexToXy(hex){var g=hxToRgb(hex);function li(u){u/=255;return u<=0.04045?u/12.92:Math.pow((u+0.055)/1.055,2.4);}var R=li(g.r),G=li(g.g),B=li(g.b);var X=R*0.4124+G*0.3576+B*0.1805,Y=R*0.2126+G*0.7152+B*0.0722,Z=R*0.0193+G*0.1192+B*0.9505;var t=X+Y+Z;if(!t)return {x:0.3127,y:0.3290};return {x:X/t,y:Y/t};}
  function tuyaToHex(s){s=String(s||"").replace(/[^0-9a-fA-F]/g,"");if(s.length<12)return "#ffaa33";var H=parseInt(s.slice(0,4),16),S=parseInt(s.slice(4,8),16)/1000,Vv=parseInt(s.slice(8,12),16)/1000;var g=hsvToRgb(H,S,Vv);return "#"+xx(g.r)+xx(g.g)+xx(g.b);}
  function hexToTuya(hex){var g=hxToRgb(hex),h=rgbToHsv(g.r,g.g,g.b);return p4(h.h)+p4(h.s*1000)+p4(h.v*1000);}
  var CFMT={
    hex:{parse:function(r){return normHexLoose(r);},pack:function(h){return h.replace("#","").toUpperCase();}},
    rgb:{parse:function(r){var m=String(r).match(/(-?\d+)[^\d-]+(-?\d+)[^\d-]+(-?\d+)/);if(!m)return "#ffaa33";return "#"+xx(+m[1])+xx(+m[2])+xx(+m[3]);},pack:function(h){var g=hxToRgb(h);return Math.round(g.r)+","+Math.round(g.g)+","+Math.round(g.b);}},
    hsv:{parse:function(r){var m=String(r).match(/(-?\d+)[^\d-]+(-?\d+)[^\d-]+(-?\d+)/);if(!m)return "#ffaa33";var g=hsvToRgb(+m[1],(+m[2])/100,(+m[3])/100);return "#"+xx(g.r)+xx(g.g)+xx(g.b);},pack:function(h){var g=hxToRgb(h),v=rgbToHsv(g.r,g.g,g.b);return Math.round(v.h)+","+Math.round(v.s*100)+","+Math.round(v.v*100);}},
    hsv1000:{parse:function(r){return tuyaToHex(r);},pack:function(h){return hexToTuya(h);}},
    tuya_v1:{parse:function(r){r=String(r).replace(/[^0-9a-fA-F]/g,"");return r.length>=6?("#"+r.slice(0,6)):"#ffaa33";},pack:function(h){var g=hxToRgb(h),v=rgbToHsv(g.r,g.g,g.b);return h.replace("#","").toLowerCase()+"0"+p3(v.h)+p2(v.s*255)+p2(v.v*255);}},
    xy:{parse:function(r){try{var o=(typeof r==="string")?JSON.parse(r):r;return xyToHex(+o.x,+o.y);}catch(e){return "#ffaa33";}},pack:function(h){var xy=hexToXy(h);return JSON.stringify({x:r4(xy.x),y:r4(xy.y)});}}
  };
  function colToHex(raw,c){return (CFMT[c.colorfmt]||CFMT.hex).parse(raw);}
  function hexToCol(hex,c){return (CFMT[c.colorfmt]||CFMT.hex).pack(hex);}
  // цвет для точки-превью
  function brightHex(hex){ var g=hxToRgb(hex),h=rgbToHsv(g.r,g.g,g.b),r=hsvToRgb(h.h,h.s,1); return "#"+xx(r.r)+xx(r.g)+xx(r.b); }
  function _lerp(a,b,t){return Math.round(a+(b-a)*t);}
  function _mix(h1,h2,t){var a=hxToRgb(h1),b=hxToRgb(h2);return "#"+xx(_lerp(a.r,b.r,t))+xx(_lerp(a.g,b.g,t))+xx(_lerp(a.b,b.b,t));}

  function bMin(c){return c.bright_min!=null?c.bright_min:10;}
  function bMax(c){return c.bright_max!=null?c.bright_max:1000;}
  function tMin(c){return c.temp_min!=null?c.temp_min:0;}
  function tMax(c){return c.temp_max!=null?c.temp_max:1000;}
  function isColour(c){return c.mode && String(V(c,c.mode)||"").toLowerCase()==="colour";}
  function isWhite(c){return c.mode && String(V(c,c.mode)||"").toLowerCase()==="white";}
  function whiteMode(c){return c.mode && !isColour(c);}   // режим задан и это НЕ «цвет» -> трактуем как белый
  // оптимистичный режим лампы до подтверждения сервером (устройство подтверждает work_mode с задержкой)
  var optMode={};   // {devId:{v,ts}}
  function effMode(c,id){ var s=String(V(c,c.mode)||"").toLowerCase(), o=optMode[id];
    if(o){ if(o.v===s || Date.now()-o.ts>4000){ delete optMode[id]; return s; } return o.v; }  // сервер догнал или таймаут -> сброс
    return s; }
  // оттенок белого по температуре (тёплый -> нейтральный -> холодный)
  function whiteHex(c){ var t=V(c,c.temp), tn=0.5;
    if(t!=null&&t!==""){ var mn=tMin(c),mx=tMax(c); tn=(mx>mn)?Math.max(0,Math.min(1,(t-mn)/(mx-mn))):0.5; }
    return tn<0.5 ? _mix("#ffb86b","#ffffff",tn*2) : _mix("#ffffff","#cfe0ff",(tn-0.5)*2); }
  // цвет точки-превью с учётом режима
  function previewHex(c){ if(whiteMode(c)) return whiteHex(c); return c.colour ? brightHex(colToHex(V(c,c.colour),c)) : "#666"; }

  L.register("light", {
    fields:[
      {k:"power",  l:"Питание (свойство)",     t:"prop"},
      {k:"mode",   l:"Режим work_mode (свойство)", t:"prop"},
      {k:"bright", l:"Яркость (свойство)",      t:"prop"},
      {k:"temp",   l:"Температура (свойство)",  t:"prop"},
      {k:"colour", l:"Цвет (свойство)",         t:"prop"},
      {k:"colorfmt",l:"Формат цвета",t:"select",o:["hex","rgb","hsv","hsv1000","tuya_v1","xy"]},
      {k:"bright_min",l:"Ярк. min",t:"num"},{k:"bright_max",l:"Ярк. max",t:"num"},
      {k:"temp_min", l:"Темп. min",t:"num"},{k:"temp_max", l:"Темп. max",t:"num"}
    ],
    reads:function(c){ return [c.power,c.mode,c.bright,c.temp,c.colour].filter(Boolean); },
    writes:function(c){ return [c.power,c.mode,c.bright,c.temp,c.colour].filter(Boolean); },
    isOn:function(c){ return c.power ? tru(V(c,c.power)) : false; },
    render:function(dev,c,ctx){
      var h='<div class="lt">';
      if(c.power){
        var on=tru(V(c,c.power));
        h+='<div class="sw-row"><span class="sw-state">'+(on?"Включено":"Выключено")+'</span>'
          +'<div class="sw" role="switch" tabindex="0" aria-checked="'+on+'" data-power></div></div>';
      }
      if(c.colour){
        if(!c.power) h+='<div class="lt-tap">›</div>';   // тап-зона, если нет тумблера (иначе тапаем по строке питания)
      }else{
        // бело-только лампа: слайдеры на карточке
        if(c.bright){ var bv=V(c,c.bright); if(bv==null||bv==="")bv=bMax(c);
          h+='<div class="lt-slider"><div class="lab"><span>Яркость</span><span data-bo>'+ctx.esc(bv)+'</span></div>'
            +'<input type="range" class="lt-rng" data-bright min="'+bMin(c)+'" max="'+bMax(c)+'" step="1" value="'+ctx.esc(bv)+'"></div>'; }
        if(c.temp){ var tv=V(c,c.temp); if(tv==null||tv==="")tv=Math.round((tMin(c)+tMax(c))/2);
          h+='<div class="lt-slider"><div class="lab"><span>Температура</span><span data-to>'+ctx.esc(tv)+'</span></div>'
            +'<input type="range" class="lt-rng lt-cct" data-temp min="'+tMin(c)+'" max="'+tMax(c)+'" step="1" value="'+ctx.esc(tv)+'"></div>'; }
      }
      return h+'</div>';
    },
    bind:function(el,dev,c,api){
      var card=el.closest(".card");
      var sw=el.querySelector("[data-power]");
      if(sw){
        function tg(){var cur=sw.getAttribute("aria-checked")==="true",next=!cur;
          sw.setAttribute("aria-checked",next); var st=el.querySelector(".sw-state"); if(st)st.textContent=next?"Включено":"Выключено";
          if(card)card.classList.toggle("on",next);
          api.postSet(dev.id,c.power,next?1:0).catch(function(){sw.setAttribute("aria-checked",cur);
            if(st)st.textContent=cur?"Включено":"Выключено"; if(card)card.classList.toggle("on",cur); api.flash("Не удалось «"+dev.id+"»");});}
        sw.addEventListener("click",tg);
        sw.addEventListener("keydown",function(e){if(e.key===" "||e.key==="Enter"){e.preventDefault();tg();}});
      }
      // цветная лампа: подсветка = текущий цвет; точка режима в шапке; тап -> пикер
      var top=card&&card.querySelector(".card-top"), id=dev.id;
      function curMode(){ return effMode(c,id); }
      function glowHex(){ var m=curMode(); return (m && m!=="colour") ? whiteHex(c) : (c.colour?brightHex(colToHex(V(c,c.colour),c)):"#666"); }
      function applyGlow(hex){ if(!card)return; card.classList.add("lt-glow");
        card.style.setProperty("--lt-color",hex); card.style.setProperty("--lt-color-soft",hex+"22"); card.style.setProperty("--lt-color-b",hex+"55"); }
      function setModeDot(){ var md=top&&top.querySelector(".lt-mode"); if(!md)return;
        if(curMode()==="colour"){ md.className="lt-mode colour"; md.style.background=""; }
        else { md.className="lt-mode white"; md.style.background=whiteHex(c); } }
      if(c.colour){
        if(c.mode && top && !top.querySelector(".lt-mode")){          // индикатор режима перед лайв-статусом
          var mdEl=document.createElement("span"); mdEl.className="lt-mode"; mdEl.style.marginLeft="auto";
          var ind=top.querySelector(".card-alive, .card-i");
          if(ind){ top.insertBefore(mdEl,ind); ind.style.marginLeft="6px"; } else top.appendChild(mdEl);
        }
        applyGlow(glowHex()); setModeDot();
      }
      if(c.colour && api.openColor){
        el.style.cursor="pointer";
        el.addEventListener("click",function(e){
          if(e.target.closest("[data-power]")) return;   // тумблер питания не открывает пикер
          var curHex=colToHex(V(c,c.colour),c);
          var bv=V(c,c.bright), tv=V(c,c.temp);
          var curTab = c.mode ? (curMode()==="colour" ? "colour" : "white") : "colour";   // белый режим -> вкладка белого; цвет -> вкладка цвета
          var white=(c.bright||c.temp)?{
            bright: c.bright?{value:(bv==null||bv===""?bMax(c):bv),min:bMin(c),max:bMax(c),onChange:function(v){ api.postSet(dev.id,c.bright,v).catch(function(){api.flash("Не удалось задать яркость");}); }}:null,
            temp:   c.temp?{value:(tv==null||tv===""?Math.round((tMin(c)+tMax(c))/2):tv),min:tMin(c),max:tMax(c),onChange:function(v){
              c.values=c.values||{}; c.values[c.temp]=v;               // свежая температура для whiteHex
              if(curTab==="white") applyGlow(whiteHex(c));             // тёплый/холодный тон на лету
              api.postSet(dev.id,c.temp,v).catch(function(){api.flash("Не удалось задать температуру");}); }}:null
          }:null;
          api.openColor(curHex, function(hex){
            if(c.mode) optMode[id]={v:"colour",ts:Date.now()};        // оптимистично: режим -> цвет (для след. тапа)
            applyGlow(brightHex(hex)); setModeDot();                   // мгновенно: карточка в новом цвете
            // последовательно: сначала mode, затем colour (не два параллельных connect'а к устройству)
            var doColour=function(){ api.postSet(dev.id,c.colour,hexToCol(hex,c)).catch(function(){api.flash("Не удалось задать цвет «"+dev.id+"»");}); };
            if(c.mode) api.postSet(dev.id,c.mode,"colour").then(doColour,doColour); else doColour();
          }, {
            startTab: curTab,
            white: white,
            onTab: c.mode?function(tab){
              curTab=tab;
              optMode[id]={v: tab==="white"?"white":"colour", ts:Date.now()};   // оптимистично запоминаем режим
              applyGlow(tab==="white" ? whiteHex(c) : brightHex(colToHex(V(c,c.colour),c)));
              setModeDot();
              api.postSet(dev.id,c.mode,tab==="white"?"white":"colour").catch(function(){});
            }:null
          });
        });
      }
      // бело-только: слайдеры на карточке
      var br=el.querySelector("[data-bright]");
      if(br){ var bo=el.querySelector("[data-bo]"), tb=null;
        br.addEventListener("input",function(){ if(bo)bo.textContent=br.value; clearTimeout(tb);
          tb=setTimeout(function(){ api.postSet(dev.id,c.bright,br.value).catch(function(){api.flash("Не удалось задать яркость «"+dev.id+"»");}); },200); }); }
      var tp=el.querySelector("[data-temp]");
      if(tp){ var to=el.querySelector("[data-to]"), tt=null;
        tp.addEventListener("input",function(){ if(to)to.textContent=tp.value; clearTimeout(tt);
          tt=setTimeout(function(){ api.postSet(dev.id,c.temp,tp.value).catch(function(){api.flash("Не удалось задать температуру «"+dev.id+"»");}); },200); }); }
    }
  });
})();
