/* button — вызывает метод */
(function () {
  var L = window.Lovelace; if (!L) return;
  L.util.css(".btn{width:100%;padding:9px;border-radius:10px;cursor:pointer;font:inherit;font-size:13px;font-weight:550;color:var(--text);background:var(--raised);border:1px solid var(--border);transition:.15s}.btn:hover{border-color:var(--link);color:var(--link)}.btn:active{transform:scale(.97)}");
  L.register("button", {
    fields:[{k:"method",l:"Метод",t:"text"}],
    methods:function(c){return c.method?[c.method]:[];},
    render:function(dev,c,ctx){return '<button class="btn">'+ctx.esc(c.label||c.title||"Выполнить")+'</button>';},
    bind:function(el,dev,c,api){
      var b=el.querySelector(".btn"); if(!b) return;
      b.addEventListener("click",function(){b.disabled=true;
        api.postMethod(dev.id,c.method).then(function(){b.disabled=false;api.refresh();})
          .catch(function(){b.disabled=false;api.flash("Ошибка "+dev.id+"."+c.method);});});
    }
  });
})();
