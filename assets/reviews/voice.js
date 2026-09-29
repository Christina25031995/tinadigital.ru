/* Голосовые отзывы: круглая кнопка, волна с прогрессом, таймер.
   Разметка: <div class="… " data-voice> <button> <div data-wave> <span data-time> <audio preload="none"> </div>
   Чтобы добавить голос в любую карточку, достаточно вставить такой блок: скрипт найдёт его сам. */
(function(){
  "use strict";
  var players = [].slice.call(document.querySelectorAll('[data-voice]'));
  if (!players.length) return;
  var BARS = 44;
  function fmt(s){ s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }

  players.forEach(function(box, n){
    var a = box.querySelector('audio'), b = box.querySelector('button'), w = box.querySelector('[data-wave]'), t = box.querySelector('[data-time]');
    if (!a || !b || !w) return;
    var total = t ? t.textContent : '', bars = [];
    for (var i = 0; i < BARS; i++){
      var bar = document.createElement('i');
      bar.style.height = (22 + Math.round(Math.abs(Math.sin((i + n * 7) * 1.7) * Math.cos(i * .37)) * 78)) + '%';
      w.appendChild(bar); bars.push(bar);
    }
    function paint(){
      var p = a.duration ? a.currentTime / a.duration : 0, k = Math.round(p * BARS);
      for (var j = 0; j < BARS; j++) bars[j].classList.toggle('on', j < k);
      if (t) t.textContent = a.currentTime > 0 && !a.ended ? fmt(a.currentTime) + ' / ' + total : total;
    }
    function set(on){ box.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function(){
      if (a.paused){
        players.forEach(function(o){ var oa = o.querySelector('audio'); if (oa && oa !== a && !oa.paused) oa.pause(); });
        var pr = a.play(); set(true);
        if (pr && pr.catch) pr.catch(function(){ set(false); });
      } else a.pause();
    });
    a.addEventListener('pause', function(){ set(false); });
    a.addEventListener('play', function(){ set(true); });
    a.addEventListener('timeupdate', paint);
    a.addEventListener('ended', function(){ set(false); a.currentTime = 0; paint(); });
    /* перемотка кликом по волне */
    w.addEventListener('click', function(e){
      if (!a.duration) return;
      var r = w.getBoundingClientRect(); a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.duration; paint();
    });
  });
})();
