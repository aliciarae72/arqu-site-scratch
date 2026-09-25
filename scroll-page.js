/* The scroll study's spine, scroll clock and canvas player. The drawing files
   register their players while the page parses; the first paint waits for them. */
(function(){
'use strict';

var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Brand easing, solved rather than approximated: cubic-bezier(.2,.7,.2,1). */
function bez(p1x,p1y,p2x,p2y){
  function A(a,b){return 1-3*b+3*a}
  function B(a,b){return 3*b-6*a}
  function C(a){return 3*a}
  function calc(t,a,b){return ((A(a,b)*t+B(a,b))*t+C(a))*t}
  function slope(t,a,b){return 3*A(a,b)*t*t+2*B(a,b)*t+C(a)}
  return function(x){
    if(x<=0)return 0; if(x>=1)return 1;
    var t=x;
    for(var i=0;i<6;i++){
      var d=slope(t,p1x,p2x); if(d===0)break;
      t-=(calc(t,p1x,p2x)-x)/d;
    }
    return calc(t,p1y,p2y);
  };
}
var brandEase = bez(.2,.7,.2,1);

/* Deterministic hash. Never Math.random() — random wobble reads as a bug. */
function rnd(i,seed){var x=Math.sin((i+1)*12.9898+(seed||0)*78.233)*43758.5453;return x-Math.floor(x);}
function clamp(v,a,b){return v<a?a:(v>b?b:v)}
function sub(t,a,b){return clamp((t-a)/(b-a),0,1)}

/* ── the spine: dots + the line that keeps going ─────────────── */
var SECTIONS = [].slice.call(document.querySelectorAll('main section'));
var dotsEl = document.getElementById('dots');
var vertical = !window.matchMedia('(max-width:760px)').matches;

SECTIONS.forEach(function(sec,i){
  var b = document.createElement('button');
  b.className = 'dot';
  b.type = 'button';
  b.setAttribute('aria-current','false');
  b.setAttribute('aria-label','Go to section ' + (i+1) + ': ' + sec.dataset.label);
  /* Geometry from brand.css: the first three sit at the motif's own spacing,
     then the rest spread out — the dots resolve, then the line takes over. */
  b.style.setProperty('--dot-gap', (i < 3 ? 22 : 34) + 'px');
  b.innerHTML = '<i></i><b>' + sec.dataset.label + '</b>';
  b.addEventListener('click', function(){
    sec.scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block:'start'});
  });
  dotsEl.appendChild(b);
});
var DOTS = [].slice.call(dotsEl.children);

var svg = document.getElementById('spineSvg');
var trunk = document.getElementById('trunkPath');
var drawn = document.getElementById('drawnPath');

function layoutSpine(){
  vertical = !window.matchMedia('(max-width:760px)').matches;
  var r = svg.getBoundingClientRect();
  if(!r.width || !r.height) return;
  svg.setAttribute('viewBox','0 0 ' + r.width + ' ' + r.height);
  var box = dotsEl.getBoundingClientRect();
  var d;
  if(vertical){
    var x = box.left - r.left + box.width/2;
    /* From the last dot, the line runs down and off the bottom edge. */
    d = 'M' + x + ' ' + (box.bottom - r.top - 8) + ' L' + x + ' ' + (r.height + 40);
    trunk.setAttribute('d','M' + x + ' ' + (box.top - r.top) + ' L' + x + ' ' + (r.height + 40));
  }else{
    var y = box.top - r.top + box.height/2;
    d = 'M' + (box.right - r.left - 8) + ' ' + y + ' L' + (r.width + 40) + ' ' + y;
    trunk.setAttribute('d','M' + (box.left - r.left) + ' ' + y + ' L' + (r.width + 40) + ' ' + y);
  }
  drawn.setAttribute('d', d);
  var len = drawn.getTotalLength();
  drawn.style.strokeDasharray = len;
  drawn.dataset.len = len;
  paintSpine(lastProgress);
}

var lastProgress = 0;
function paintSpine(p){
  var len = parseFloat(drawn.dataset.len || 0);
  /* The line resolves on the brand curve, exactly as .elr does in CSS —
     except the clock here is the scroll bar. */
  drawn.style.strokeDashoffset = len * (1 - brandEase(p));
}

/* ── scroll state ────────────────────────────────────────────── */
var readout = document.getElementById('readout');
var players = [];

function sectionProgress(sec){
  var r = sec.getBoundingClientRect();
  var vh = window.innerHeight || 1;
  /* 0 when the section's top hits the bottom of the viewport,
     1 when its bottom hits the top. Pure function of position. */
  return clamp((vh - r.top) / (vh + r.height), 0, 1);
}

function onScroll(){
  var doc = document.documentElement;
  var max = doc.scrollHeight - window.innerHeight;
  lastProgress = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
  paintSpine(lastProgress);

  var active = 0, mid = window.innerHeight * 0.45;
  SECTIONS.forEach(function(sec,i){
    var r = sec.getBoundingClientRect();
    if(r.top <= mid) active = i;
    if(r.top < window.innerHeight * 0.85 && r.bottom > 0) sec.classList.add('seen');
  });
  DOTS.forEach(function(d,i){
    d.setAttribute('aria-current', i === active ? 'true' : 'false');
    d.classList.toggle('past', i < active);
  });
  readout.textContent = ('0' + active).slice(-2) + ' — ' + SECTIONS[active].dataset.label;

  players.forEach(function(p){ p.tick(); });
}

var POINTER = {x:0, y:0, on:false};
window.addEventListener('pointermove', function(e){
  POINTER.x = e.clientX; POINTER.y = e.clientY; POINTER.on = true; request();
}, {passive:true});

/* ── canvas players. draw(ctx,t,w,h) is pure in t. ───────────── */
function Player(id, sectionId, draw, live){
  var cv = document.getElementById(id);
  if(!cv) return;
  var sec = document.getElementById(sectionId);
  var ctx = cv.getContext('2d');
  var w = 0, h = 0, lastT = -1;

  function size(){
    var r = cv.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    lastT = -1;
  }
  function tick(){
    var r = cv.getBoundingClientRect();
    if(r.bottom < -200 || r.top > window.innerHeight + 200) return;
    /* Section progress remapped: the middle 70% of the pass does the work,
       so the drawing completes while the section is still on screen. */
    var t = REDUCED ? 1 : clamp((sectionProgress(sec) - 0.15) / 0.55, 0, 1);
    if(!live && Math.abs(t - lastT) < 0.002) return;
    lastT = t;
    ctx.clearRect(0,0,w,h);
    /* pointer in canvas coords; parked far off-canvas until the mouse
       has actually been over the page, so nothing reacts to 0,0. */
    draw(ctx, t, w, h, {px: POINTER.on ? POINTER.x - r.left : -9999,
                        py: POINTER.on ? POINTER.y - r.top  : -9999});
  }
  players.push({size:size, tick:tick});
  size();
}

var INK='#221f20', INK2='#56514f', INK3='#6e6866', LINE='#e7e2db', PUR='#5e54c8', PUR2='#8c82fa', TINT='#f3f1ff';

/* ── wiring ─────────────────────────────────────────────────── */
var queued = false;

function request(){
  if(queued) return; queued = true;
  requestAnimationFrame(function(){ queued = false; onScroll(); });
}
window.addEventListener('scroll', request, {passive:true});
window.addEventListener('resize', function(){
  players.forEach(function(p){p.size();});
  layoutSpine(); request();
});
document.addEventListener('DOMContentLoaded', function(){ layoutSpine(); onScroll(); });
/* Fonts land after first paint and change the dot box; re-measure once. */
if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ layoutSpine(); });

window.ScrollStudy = {REDUCED: REDUCED, brandEase: brandEase, rnd: rnd, clamp: clamp, sub: sub, Player: Player, INK: INK, INK2: INK2, INK3: INK3, LINE: LINE, PUR: PUR, PUR2: PUR2, TINT: TINT};
})();
