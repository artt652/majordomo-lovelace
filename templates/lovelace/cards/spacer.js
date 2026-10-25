/* spacer — пустая карточка-распорка (перенос следующей на новую строку) */
(function () {
  var L = window.Lovelace; if (!L) return;
  L.register("spacer", {
    noObject: true,
    render:function(){ return ""; }   // ничего не рисует; перенос делает CSS/ядро
  });
})();
