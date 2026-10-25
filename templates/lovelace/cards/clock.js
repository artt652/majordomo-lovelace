/* ============================================================================
 * ВНЕШНЯЯ карточка: часы (аналоговые и цифровые). Время локальное (устройство),
 * объект Majordomo не нужен. Настройки — через редактор карточки (fields).
 *
 * Поля:
 *   view    — тип: analog / digital
 *   seconds — показывать секунды (да/нет)
 *   fmt     — формат цифровых: 24 / 12
 *   date    — показывать дату (да/нет)
 *   weekday — показывать день недели (да/нет)
 *   marks   — метки аналоговых: цифры / чёрточки / нет
 *   sechand — секундная стрелка аналоговых (да/нет)
 * ==========================================================================*/
(function () {
  if (!window.Lovelace) return;
  var L = window.Lovelace;

  var WD = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
  var WD_SH = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
  var MON = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

  var st = document.createElement("style");
  st.textContent =
    ".clk{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:6px 0;min-width:0}" +
    // цифровые
    ".clk-digi{font-family:var(--mono);font-weight:600;line-height:1;letter-spacing:.5px;color:var(--text);" +
      "font-size:clamp(26px,14cqw,52px);display:flex;align-items:baseline;gap:4px}" +
    ".clk-digi .clk-sec{font-size:.5em;color:var(--muted);font-weight:600}" +
    ".clk-digi .clk-ap{font-size:.42em;color:var(--muted);font-weight:600;margin-left:2px}" +
    ".clk-date{font-size:13px;color:var(--muted);text-align:center}" +
    ".clk-wd{font-size:12px;color:var(--faint)}" +
    // аналоговые
    ".clk-face{width:100%;max-width:180px;aspect-ratio:1/1}" +
    ".clk-face svg{width:100%;height:100%;display:block}" +
    ".clk-face .dial{fill:var(--surface);stroke:var(--border);stroke-width:1.5}" +
    ".clk-face .tick{stroke:var(--faint);stroke-width:1.5}" +
    ".clk-face .tick.h{stroke:var(--muted);stroke-width:2.5}" +
    ".clk-face .num{fill:var(--muted);font-size:9px;font-family:var(--mono);text-anchor:middle;dominant-baseline:central}" +
    ".clk-face .hand{stroke:var(--text);stroke-linecap:round}" +
    ".clk-face .hh{stroke-width:4}" +
    ".clk-face .mh{stroke-width:3}" +
    ".clk-face .sh{stroke:var(--active);stroke-width:1.5}" +
    ".clk-face .cap{fill:var(--active)}";
  document.head.appendChild(st);

  function pad(n){ return (n<10?"0":"")+n; }
  function truthy(v){ return v===true||v==="1"||v===1||v==="да"||v==="yes"||v==="on"; }

  // тикер: одна общая петля обновляет все часы на странице
  var ticking = false;
  function startTick(){
    if (ticking) return; ticking = true;
    function loop(){ paintAll(); requestAnimationFrame(function(){ setTimeout(loop, 250); }); }
    loop();
  }
  function paintAll(){ document.querySelectorAll(".clk[data-clk]").forEach(paint); }

  function digital(root, c, now){
    var h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    var ap = "";
    if ((c.fmt||"24") === "12"){ ap = h<12 ? "AM" : "PM"; h = h%12; if (h===0) h=12; }
    var main = (((c.fmt||"24")==="12") ? h : pad(h)) + ":" + pad(m);
    var html = '<div class="clk-digi">'+main;
    if (truthy(c.seconds)) html += '<span class="clk-sec">'+pad(s)+'</span>';
    if (ap) html += '<span class="clk-ap">'+ap+'</span>';
    html += '</div>';
    if (truthy(c.date)) html += '<div class="clk-date">'+now.getDate()+' '+MON[now.getMonth()]+' '+now.getFullYear()+'</div>';
    if (truthy(c.weekday)) html += '<div class="clk-wd">'+WD[now.getDay()]+'</div>';
    root.innerHTML = html;
  }

  function faceStatic(c){
    // строим циферблат один раз (метки), стрелки обновляем отдельно
    var marks = c.marks || "чёрточки";
    var ticks = "";
    for (var i=0;i<60;i++){
      var a = (i/60)*2*Math.PI, big = (i%5===0);
      if (marks==="нет" && !big) continue;
      var r1 = big?42:44.5, r2 = 47;
      var x1 = 50+r1*Math.sin(a), y1 = 50-r1*Math.cos(a);
      var x2 = 50+r2*Math.sin(a), y2 = 50-r2*Math.cos(a);
      if (marks==="нет") continue;
      ticks += '<line class="tick'+(big?" h":"")+'" x1="'+x1.toFixed(2)+'" y1="'+y1.toFixed(2)+'" x2="'+x2.toFixed(2)+'" y2="'+y2.toFixed(2)+'"/>';
    }
    var nums = "";
    if (marks==="цифры"){
      ticks = "";
      for (var n=1;n<=12;n++){
        var an=(n/12)*2*Math.PI, rr=38;
        var nx=50+rr*Math.sin(an), ny=50-rr*Math.cos(an);
        nums += '<text class="num" x="'+nx.toFixed(2)+'" y="'+ny.toFixed(2)+'">'+n+'</text>';
      }
    }
    return '<circle class="dial" cx="50" cy="50" r="48"/>'+ticks+nums;
  }

  function analog(root, c, now){
    var need = root.querySelector("svg");
    if (!need){
      root.innerHTML = '<div class="clk-face"><svg viewBox="0 0 100 100">'+faceStatic(c)+
        '<line class="hand hh" x1="50" y1="50" x2="50" y2="26"/>'+
        '<line class="hand mh" x1="50" y1="50" x2="50" y2="16"/>'+
        (truthy(c.sechand)?'<line class="hand sh" x1="50" y1="56" x2="50" y2="12"/>':'')+
        '<circle class="cap" cx="50" cy="50" r="2.4"/></svg></div>';
    }
    var svg = root.querySelector("svg"); if (!svg) return;
    var h=now.getHours()%12, m=now.getMinutes(), s=now.getSeconds(), ms=now.getMilliseconds();
    var ha=(h+m/60)/12*360, ma=(m+s/60)/60*360, sa=(s+ms/1000)/60*360;
    var hh=svg.querySelector(".hh"), mh=svg.querySelector(".mh"), sh=svg.querySelector(".sh");
    if(hh) hh.setAttribute("transform","rotate("+ha.toFixed(2)+" 50 50)");
    if(mh) mh.setAttribute("transform","rotate("+ma.toFixed(2)+" 50 50)");
    if(sh) sh.setAttribute("transform","rotate("+sa.toFixed(2)+" 50 50)");
  }

  function paint(root){
    var c = readCfg(root);
    var now = new Date();
    if ((c.view||"digital")==="analog") analog(root, c, now);
    else { if (root.querySelector("svg")) root.innerHTML=""; digital(root, c, now); }
  }

  // конфиг храним в data-атрибуте (карточка noObject получает поля в dev/ctrl)
  function readCfg(root){
    try { return JSON.parse(root.getAttribute("data-clk")||"{}"); } catch(e){ return {}; }
  }

  L.register("clock", {
    noObject: true,
    noHeader: true,
    fields: [
      { k:"view",    l:"Тип",            t:"seg",    o:["digital","analog"] },
      { k:"seconds", l:"Секунды",        t:"seg",    o:["нет","да"] },
      { k:"fmt",     l:"Формат (цифр.)", t:"seg",    o:["24","12"] },
      { k:"date",    l:"Дата",           t:"seg",    o:["нет","да"] },
      { k:"weekday", l:"День недели",    t:"seg",    o:["нет","да"] },
      { k:"marks",   l:"Метки (аналог.)",t:"seg",    o:["чёрточки","цифры","нет"] },
      { k:"sechand", l:"Секундная (аналог.)", t:"seg", o:["да","нет"] }
    ],
    render: function (dev, c, ctx) {
      var cfg = {
        view:c.view||"digital", seconds:c.seconds, fmt:c.fmt||"24",
        date:c.date, weekday:c.weekday, marks:c.marks||"чёрточки", sechand:(c.sechand==null?"да":c.sechand)
      };
      return '<div class="clk" data-clk=\''+ctx.esc(JSON.stringify(cfg))+'\'></div>';
    },
    bind: function (el) {
      var root = el.querySelector(".clk");
      if (root){ paint(root); startTick(); }
    }
  });
})();
