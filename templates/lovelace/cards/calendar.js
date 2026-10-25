/* ============================================================================
 * ВНЕШНЯЯ карточка: календарь. События хранятся в БД (таблица lovelace_calendar),
 * общий на всю установку. API — маршрут модуля api.php/module/lovelace/calendar.
 *
 * Дни с событиями подсвечены (точка). Тап по дню — список событий + добавление.
 * Тап по событию — редактирование в той же форме.
 * ==========================================================================*/
(function () {
  if (!window.Lovelace) return;
  var L = window.Lovelace;
  var API = new URL("../../api.php/module/lovelace/", location.href).href;   // маршрут модуля
  function unwrap(r){ return r.json().then(function(j){ return (j && j.apiHandleResult!==undefined) ? j.apiHandleResult : j; }); }

  var MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  var WD = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  var COLORS = ["#e5484d","#f76808","#ffc53d","#46a758","#2593d8","#8e4ec6","#e93d82","#8b8f98"];  // палитра меток

  var st = document.createElement("style");
  st.textContent =
    ".cal{display:flex;flex-direction:column;gap:8px}" +
    ".cal-head{display:flex;align-items:center;gap:6px}" +
    ".cal-title{flex:1;min-width:0;font-size:13px;font-weight:600;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".cal-nav{width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:var(--raised);color:var(--text);cursor:pointer;font-size:15px;flex:none;padding:0}" +
    ".cal-nav:active{transform:scale(.92)}" +
    ".cal-week{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}" +
    ".cal-week span{text-align:center;font-size:10px;color:var(--muted);padding:2px 0;min-width:0;overflow:hidden}" +
    ".cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}" +
    ".cal-day{position:relative;min-width:0;min-height:28px;display:flex;align-items:center;justify-content:center;" +
      "border-radius:8px;font-size:12.5px;color:var(--text);cursor:pointer;border:1px solid transparent}" +
    ".cal-day.blank{cursor:default}" +
    ".cal-day:not(.blank):hover{background:var(--raised)}" +
    ".cal-day.today{border-color:var(--active);color:var(--active);font-weight:600}" +
    ".cal-day.ev{background:var(--active-soft)}" +
    ".cal-dots{position:absolute;bottom:3px;left:0;right:0;display:flex;gap:2px;justify-content:center;overflow:hidden;pointer-events:none}" +
    ".cal-dot{width:4px;height:4px;border-radius:50%;background:var(--active);flex:none}" +
    // окно дня
    ".cal-ov{position:fixed;inset:0;z-index:78;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:14px}" +
    ".cal-ov.show{display:flex}" +
    ".cal-box{background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:14px;width:100%;max-width:440px;max-height:82vh;display:flex;flex-direction:column;overflow:hidden}" +
    ".cal-bhead{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--border)}" +
    ".cal-bhead b{flex:1;font-size:14px}" +
    ".cal-bbody{overflow:auto;padding:10px 14px 14px}" +
    ".cal-ev{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)}" +
    ".cal-ev:last-child{border-bottom:0}" +
    ".cal-ev-c{width:4px;align-self:stretch;border-radius:3px;background:var(--active);flex:none}" +
    ".cal-ev-t{font-family:var(--mono);font-size:12px;color:var(--active);flex:none;min-width:38px}" +
    ".cal-ev-main{flex:1;min-width:0}" +
    ".cal-ev-title{font-size:13px}" +
    ".cal-ev-note{font-size:12px;color:var(--muted);margin-top:2px;overflow-wrap:anywhere}" +
    ".cal-del{flex:none;border:0;background:transparent;color:var(--faint);cursor:pointer;font-size:15px;padding:2px 4px}" +
    ".cal-del:hover{color:var(--bad)}" +
    ".cal-empty{color:var(--muted);font-size:13px;padding:8px 0}" +
    ".cal-form{display:flex;flex-direction:column;gap:8px;margin-top:12px;border-top:1px solid var(--border);padding-top:12px}" +
    ".cal-form .cal-row{display:flex;gap:8px}" +
    ".cal-form input,.cal-form textarea{width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:9px;padding:9px 10px;font:inherit;font-size:13px}" +
    ".cal-form input[type=time]{max-width:120px;flex:none}" +
    ".cal-colors{display:flex;gap:8px;flex-wrap:wrap}" +
    ".cal-sw{width:26px;height:26px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}" +
    ".cal-sw.sel{border-color:var(--text);box-shadow:0 0 0 2px var(--surface) inset}" +
    ".cal-form textarea{resize:vertical;min-height:38px}" +
    ".cal-add{padding:9px 14px;border-radius:9px;border:1px solid var(--active);background:var(--active);color:var(--on-active);font:inherit;font-weight:600;font-size:13px;cursor:pointer;flex:1}" +
    ".cal-frow{display:flex;gap:8px}" +
    ".cal-cancel{padding:9px 14px;border-radius:9px;border:1px solid var(--border);background:var(--raised);color:var(--text);font:inherit;font-size:13px;cursor:pointer;flex:none}" +
    ".cal-editlbl{font-size:12px;color:var(--active);font-weight:600}" +
    ".cal-ev.editing{background:var(--active-soft);border-radius:8px;margin:0 -6px;padding-left:6px;padding-right:6px}" +
    ".cal-ev-main{cursor:pointer}" +
    ".cal-close{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--raised);color:var(--text);cursor:pointer}";
  document.head.appendChild(st);

  function pad(n){ return (n<10?"0":"")+n; }
  function ymd(y,m,d){ return y+"-"+pad(m+1)+"-"+pad(d); }   // m 0-based
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }

  // ---- состояние (общее для всех карточек-календарей) ----
  var now = new Date();
  var st_y = now.getFullYear(), st_m = now.getMonth();
  var events = null, loading = false;   // events: [{id,date,time,title,note}]

  function loadEvents(cb){
    if (loading) return;
    loading = true;
    fetch(API + "calendar", { cache: "no-store", credentials: "same-origin" })
      .then(unwrap)
      .then(function (j) { loading = false; events = (j && j.events) ? j.events : []; if (cb) cb(); repaintAll(); })
      .catch(function () { loading = false; events = events || []; if (cb) cb(); });
  }
  function saveEvent(ev, cb){
    var body = {}; for (var k in ev) body[k] = ev[k];
    fetch(API + "calendar", { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"same-origin", body: JSON.stringify(body) })
      .then(unwrap)
      .then(function (j) { if (j && j.events) events = j.events; if (cb) cb(j); repaintAll(); })
      .catch(function () { if (cb) cb(null); });
  }
  function delEvent(id, cb){ saveEvent({ op:"delete", id:id }, cb); }

  function eventsOn(dateStr){ return (events||[]).filter(function(e){ return e.date===dateStr; })
      .sort(function(a,b){ return (a.time||"").localeCompare(b.time||""); }); }

  function repaintAll(){ document.querySelectorAll(".cal[data-cal]").forEach(function(el){ paintCal(el); }); }

  function paintCal(root){
    if (events === null) { root.innerHTML = '<div class="cal-empty">Загрузка…</div>'; loadEvents(); return; }
    var first = new Date(st_y, st_m, 1);
    var offset = (first.getDay() + 6) % 7;          // Пн-первый
    var days = new Date(st_y, st_m + 1, 0).getDate();
    var today = new Date(); var tstr = ymd(today.getFullYear(), today.getMonth(), today.getDate());

    var h = '<div class="cal-head"><button class="cal-nav" data-nav="-1">‹</button>' +
      '<span class="cal-title">' + MONTHS[st_m] + ' ' + st_y + '</span>' +
      '<button class="cal-nav" data-nav="1">›</button></div>' +
      '<div class="cal-week">' + WD.map(function(w){ return '<span>'+w+'</span>'; }).join("") + '</div>' +
      '<div class="cal-grid">';
    for (var i=0;i<offset;i++) h += '<div class="cal-day blank"></div>';
    for (var d=1;d<=days;d++){
      var ds = ymd(st_y, st_m, d);
      var evs = eventsOn(ds);
      var cnt = evs.length;
      var cls = "cal-day" + (ds===tstr?" today":"") + (cnt?" ev":"");
      var dots = cnt ? '<span class="cal-dots">' + evs.slice(0,3).map(function(e){
        return '<span class="cal-dot" style="background:'+(e.color||"var(--active)")+'"></span>';
      }).join("") + '</span>' : '';
      h += '<div class="'+cls+'" data-date="'+ds+'">'+d+dots+'</div>';
    }
    h += '</div>';
    root.innerHTML = h;

    root.querySelectorAll("[data-nav]").forEach(function(b){
      b.addEventListener("click", function(e){ e.stopPropagation();
        st_m += parseInt(b.dataset.nav,10);
        if (st_m<0){ st_m=11; st_y--; } else if (st_m>11){ st_m=0; st_y++; }
        repaintAll();
      });
    });
    root.querySelectorAll(".cal-day[data-date]").forEach(function(c){
      c.addEventListener("click", function(){ openDay(c.dataset.date); });
    });
  }

  // ---- окно дня ----
  var ov=null, ovTitle=null, ovBody=null, ovDate="", editId=null;
  function ensureOv(){
    if (ov) return;
    ov=document.createElement("div"); ov.className="cal-ov";
    ov.innerHTML='<div class="cal-box"><div class="cal-bhead"><b></b><button class="cal-close">\u2715</button></div><div class="cal-bbody"></div></div>';
    document.body.appendChild(ov);
    ovTitle=ov.querySelector("b"); ovBody=ov.querySelector(".cal-bbody");
    ov.querySelector(".cal-close").addEventListener("click", closeOv);
    ov.addEventListener("click", function(e){ if(e.target===ov) closeOv(); });
    document.addEventListener("keydown", function(e){ if(e.key==="Escape"&&ov.classList.contains("show")) closeOv(); });
  }
  function fmtDate(ds){ var p=ds.split("-"); return p[2]+" "+(MONTHS[(+p[1])-1]||"").toLowerCase()+" "+p[0]; }
  function openDay(ds){
    ensureOv(); ovDate=ds; editId=null; ovTitle.textContent=fmtDate(ds);
    renderDay();
    ov.classList.add("show"); document.documentElement.style.overflow="hidden";
  }
  function closeOv(){ if(!ov) return; ov.classList.remove("show"); document.documentElement.style.overflow=""; editId=null; }
  function renderDay(){
    var list = eventsOn(ovDate);
    var ed = editId ? list.filter(function(e){return e.id===editId;})[0] : null;
    var h = list.length ? list.map(function(e){
      return '<div class="cal-ev'+(e.id===editId?" editing":"")+'"><span class="cal-ev-c" style="background:'+(e.color||"var(--active)")+'"></span>' +
        '<span class="cal-ev-t">'+esc(e.time||"—")+'</span>' +
        '<div class="cal-ev-main" data-edit="'+esc(e.id)+'"><div class="cal-ev-title">'+esc(e.title)+'</div>' +
        (e.note?'<div class="cal-ev-note">'+esc(e.note)+'</div>':'') + '</div>' +
        '<button class="cal-del" data-del="'+esc(e.id)+'" aria-label="Удалить">\u2715</button></div>';
    }).join("") : '<div class="cal-empty">Событий нет</div>';
    var curColor = ed ? (ed.color||COLORS[0]) : COLORS[0];
    h += '<div class="cal-form">' +
      (ed?'<div class="cal-editlbl">Редактирование события</div>':'') +
      '<div class="cal-row"><input type="time" id="cal-t" value="'+esc(ed?ed.time:"")+'"><input type="text" id="cal-title" placeholder="Название события" maxlength="200" value="'+esc(ed?ed.title:"")+'"></div>' +
      '<textarea id="cal-note" placeholder="Заметка (необязательно)" maxlength="1000">'+esc(ed?ed.note:"")+'</textarea>' +
      '<div class="cal-colors">' + COLORS.map(function(c){
        return '<button class="cal-sw'+(c===curColor?" sel":"")+'" data-c="'+c+'" style="background:'+c+'" aria-label="Цвет"></button>';
      }).join("") + '</div>' +
      '<div class="cal-frow">' +
      (ed?'<button class="cal-cancel">Отмена</button>':'') +
      '<button class="cal-add">'+(ed?"Сохранить":"Добавить")+'</button></div></div>';
    ovBody.innerHTML = h;
    ovBody.querySelectorAll("[data-del]").forEach(function(b){
      b.addEventListener("click", function(){ delEvent(b.dataset.del, function(){ if(editId===b.dataset.del) editId=null; renderDay(); }); });
    });
    ovBody.querySelectorAll("[data-edit]").forEach(function(m){
      m.addEventListener("click", function(){ editId=m.dataset.edit; renderDay(); ovBody.scrollTop=ovBody.scrollHeight; });
    });
    ovBody.querySelectorAll(".cal-sw").forEach(function(sw){
      sw.addEventListener("click", function(){
        ovBody.querySelectorAll(".cal-sw").forEach(function(x){ x.classList.remove("sel"); });
        sw.classList.add("sel");
      });
    });
    var cancel=ovBody.querySelector(".cal-cancel");
    if(cancel) cancel.addEventListener("click", function(){ editId=null; renderDay(); });
    ovBody.querySelector(".cal-add").addEventListener("click", function(){
      var title = ovBody.querySelector("#cal-title").value.trim();
      if (!title){ ovBody.querySelector("#cal-title").focus(); return; }
      var selSw = ovBody.querySelector(".cal-sw.sel");
      var payload = { op:"add", date:ovDate, time:ovBody.querySelector("#cal-t").value, title:title,
        note:ovBody.querySelector("#cal-note").value, color:(selSw?selSw.dataset.c:"") };
      if (editId) payload.id = editId;          // правка существующего
      saveEvent(payload, function(){ editId=null; renderDay(); });
    });
  }

  L.register("calendar", {
    noObject: true,
    render: function () { return '<div class="cal" data-cal></div>'; },
    bind: function (el) {
      var root = el.querySelector(".cal"); if (root) paintCal(root);
      // ширина берётся из настроек карточки (1..4/full) — авто-растяжку не навязываем
    }
  });
})();
