/* Мобильная навигация внутренних страниц (≤760px): док «Кейсы · Услуги · Связаться» как на главной,
   лист «Услуги», шапка с фоном под цвет секции под ней. На компьютере док и лист скрыты CSS-ом. */
(function(){
  "use strict";
  var me = document.currentScript;
  var root = me ? new URL('../../', me.src).href : '/';
  var path = location.pathname;
  var sec = /\/(projects|cases)\//.test(path) ? 'cases' : /\/(turnkey|seo-geo|direct)\//.test(path) ? 'services' : '';
  var cur = (path.match(/\/(turnkey|seo-geo|direct)\//) || [])[1] || '';
  var TG = 'https://t.me/belovachristina';

  var ICON = {
    cases: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.2"/><rect x="11" y="2.5" width="6.5" height="6.5" rx="1.2"/><rect x="2.5" y="11" width="6.5" height="6.5" rx="1.2"/><rect x="11" y="11" width="6.5" height="6.5" rx="1.2"/></svg>',
    services: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M10 2.5l7.5 4-7.5 4-7.5-4 7.5-4z"/><path d="M2.5 10.2l7.5 4 7.5-4"/><path d="M2.5 13.8l7.5 4 7.5-4"/></svg>',
    contact: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 3L2.5 9.2l5.6 2 2 5.8L17.5 3z"/><path d="M8.1 11.2L17.5 3"/></svg>'
  };
  var SVC = [
    ['turnkey', 'Сайты под ключ', 'Стратегия, UX, дизайн, разработка и запуск на вашем домене', 'от 60 000 ₽'],
    ['seo-geo', 'SEO + GEO', 'Видимость в Яндексе, Google и нейросетях', 'от 40 000 ₽'],
    ['direct', 'Яндекс Директ', 'Платный поисковый трафик на подготовленные посадочные', 'от 35 000 ₽']
  ];

  function el(html){ var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

  var dock = el('<nav class="mn-dock" aria-label="Мобильная навигация">' +
    '<a class="mn-dock-btn' + (sec === 'cases' ? ' is-active' : '') + '" href="' + root + 'projects/"' + (sec === 'cases' && /\/projects\/$/.test(path) ? ' aria-current="page"' : '') + '>' + ICON.cases + '<span>Кейсы</span></a>' +
    '<button class="mn-dock-btn' + (sec === 'services' ? ' is-active' : '') + '" type="button" aria-controls="mnSvc" aria-expanded="false">' + ICON.services + '<span>Услуги</span></button>' +
    '<a class="mn-dock-btn" href="' + TG + '" target="_blank" rel="noopener">' + ICON.contact + '<span>Связаться</span></a>' +
    '</nav>');
  var ov = el('<div class="mn-ov"></div>');
  var sheet = el('<div class="mn-sheet" id="mnSvc" role="dialog" aria-modal="true" aria-label="Услуги"><div class="mn-sheet-handle"></div><div class="mn-sheet-head">Услуги</div><div class="mn-sheet-body">' +
    SVC.map(function(s){ return '<a class="mn-card' + (s[0] === cur ? ' is-active" aria-current="page' : '') + '" href="' + root + s[0] + '/"><b>' + s[1] + '</b><span>' + s[2] + '</span><em>' + s[3] + '</em><i aria-hidden="true">→</i></a>'; }).join('') +
    '<a class="mn-all" href="' + root + 'projects/">Все кейсы <i aria-hidden="true">→</i></a></div></div>');
  document.body.appendChild(ov); document.body.appendChild(sheet); document.body.appendChild(dock);
  document.body.classList.add('mn-on');

  var btn = dock.querySelector('button');
  function set(open){
    sheet.classList.toggle('is-open', open); ov.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.classList.toggle('is-active', open || sec === 'services');
  }
  btn.addEventListener('click', function(){ set(!sheet.classList.contains('is-open')); });
  ov.addEventListener('click', function(){ set(false); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') set(false); });

  /* шапка: фон под цвет секции, которая сейчас под ней */
  var hdr = document.querySelector('header.top');
  if (!hdr) return;
  hdr.classList.add('mn-hdr');
  var mq = matchMedia('(max-width:760px)'), tick = false;
  /* цвет берём у секции (section/footer/прямой потомок body или main), а не у картинки под шапкой */
  function bg(node){
    for (var n = node; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement){
      var p = n.parentElement, isSec = /^(SECTION|FOOTER|ARTICLE)$/.test(n.tagName) || p === document.body || (p && p.tagName === 'MAIN');
      if (!isSec) continue;
      var c = getComputedStyle(n).backgroundColor, m = c.match(/[\d.]+/g);
      if (m && (m.length < 4 || +m[3] > .5)) return m;
    }
    var b = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g);
    return b && (b.length < 4 || +b[3] > .5) ? b : null;
  }
  function upd(){
    tick = false;
    if (!mq.matches){ hdr.classList.remove('mn-light'); return; }
    var y = hdr.getBoundingClientRect().bottom + 2, light = false;
    var stack = document.elementsFromPoint ? document.elementsFromPoint(innerWidth / 2, y) : [];
    for (var i = 0; i < stack.length; i++){
      if (hdr.contains(stack[i]) || dock.contains(stack[i]) || sheet.contains(stack[i])) continue;
      var m = bg(stack[i]);
      if (m){ light = (m[0] * .3 + m[1] * .59 + m[2] * .11) > 150; break; }
    }
    hdr.classList.toggle('mn-light', light);
  }
  function req(){ if (!tick){ tick = true; requestAnimationFrame(upd); } }
  addEventListener('scroll', req, { passive:true }); addEventListener('resize', req);
  if (mq.addEventListener) mq.addEventListener('change', req);
  req(); addEventListener('load', req);
})();
