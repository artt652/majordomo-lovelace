/* camera — снапшот из свойства */
(function () {
  var L = window.Lovelace; if (!L) return;
  L.util.css(".cam{border-radius:10px;overflow:hidden;background:#000;aspect-ratio:16/9;display:flex}.cam img{width:100%;height:100%;object-fit:cover;display:block}.textv{font-size:14px;color:var(--text);word-break:break-word}");
  var V = L.util.V;
  L.register("camera", {
    fields:[{k:"image_prop",l:"Свойство снапшота",t:"prop"}],
    reads:function(c){return c.image_prop?[c.image_prop]:[];},
    render:function(dev,c,ctx){
      var img=V(c,c.image_prop,c.image);
      if(!img || !/^(https?:|\/|data:)/.test(String(img))) return '<div class="textv">нет изображения</div>';
      return '<div class="cam"><img src="'+ctx.esc(img)+'" alt="'+ctx.esc(dev.title||dev.id)+'" loading="lazy"></div>';
    }
  });
})();
