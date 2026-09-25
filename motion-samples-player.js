/* The motion reel's shared player. Every panel is a pure function of t, so
   scrubbing is exact; each panel file draws its studies through it. */
(function(){
  "use strict";
  var PURPLE="#8c82fa", TINT="#ece9ff", INK="#221f20", INK3="#6b6566", INK4="#b8b3b4";
  var players={};

  function ease(t){ return 1-Math.pow(1-t,3); }             // easeOutCubic
  function easeInOut(t){ return t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function lerp(a,b,t){ return a+(b-a)*t; }

  // the pointer as the panel sees it: position, and drag distance while held
  function trackPointer(cv, self, render){
    cv.addEventListener("pointermove",function(e){
      var r=cv.getBoundingClientRect();
      var nx=e.clientX-r.left, ny=e.clientY-r.top;
      if(self.pointer.down){ self.pointer.dx+=(nx-self.pointer.x)*0.01; self.pointer.dy+=(ny-self.pointer.y)*0.01; }
      self.pointer.x=nx; self.pointer.y=ny;
      if(!self.playing) render();
    });
    cv.addEventListener("pointerleave",function(){ self.pointer.x=-9999; self.pointer.y=-9999; self.pointer.down=false; });
    cv.addEventListener("pointerdown",function(e){ self.pointer.down=true; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointerup",function(){ self.pointer.down=false; });
  }

  // autoplay only while visible, so offscreen panels cost nothing
  function autoplayWhileVisible(cv, self){
    if(!("IntersectionObserver" in window)) return;
    new IntersectionObserver(function(es){
      es.forEach(function(en){
        if(en.isIntersecting){ if(!self.external && !self.playing && (self.loop || self.t<1)) self.play(); }
        else self.stop();
      });
    },{threshold:.25}).observe(cv);
  }

  // ---- shared player: every panel is a pure function of t (0..1), so scrubbing is exact ----
  function Player(id, draw, opts){
    opts=opts||{};
    var cv=document.getElementById("c"+id), ctx=cv.getContext("2d");
    var scrub=document.querySelector('[data-scrub="'+id+'"]');
    var tv=document.querySelector('[data-tv="'+id+'"]');
    var btn=document.querySelector('[data-play="'+id+'"]');
    var self={t:0,playing:false,dur:opts.dur||3200,loop:!!opts.loop,pointer:{x:-9999,y:-9999,down:false,dx:0,dy:0},external:false};

    function fit(){
      var r=window.devicePixelRatio||1, w=cv.clientWidth;
      if(!w) return;
      cv.width=Math.round(w*r); cv.height=Math.round(w*(opts.ratio||0.475)*r);
      cv.style.height=Math.round(w*(opts.ratio||0.475))+"px";
      ctx.setTransform(r,0,0,r,0,0);
      render();
    }
    function render(){
      var w=cv.clientWidth, h=cv.clientHeight;
      ctx.clearRect(0,0,w,h);
      draw(ctx,self.t,w,h,self);
      if(scrub && !self.dragging) scrub.value=Math.round(self.t*1000);
      if(tv) tv.textContent=Math.round(self.t*100)+"%";
    }
    var last=0;
    function frame(ts){
      if(!self.playing){ return; }
      if(!last) last=ts;
      var dt=(ts-last)/self.dur; last=ts;
      self.t+=dt;
      if(self.t>=1){ if(self.loop){ self.t-=1; } else { self.t=1; self.playing=false; } }
      render();
      if(self.playing) requestAnimationFrame(frame);
    }
    self.play=function(){ if(self.t>=1) self.t=0; self.playing=true; last=0; requestAnimationFrame(frame); };
    self.stop=function(){ self.playing=false; };
    self.set=function(t){ self.t=clamp(t,0,1); render(); };
    self.render=render;

    btn.addEventListener("click",function(){ self.t=0; self.play(); });
    scrub.addEventListener("input",function(){ self.dragging=true; self.playing=false; self.set(scrub.value/1000); self.dragging=false; });
    trackPointer(cv,self,render);

    window.addEventListener("resize",fit);
    autoplayWhileVisible(cv,self);
    players[id]=self;
    fit();
    return self;
  }

  // deterministic pseudo-random so every replay and every scrub is identical
  function rnd(i,s){ var x=Math.sin(i*127.1+ (s||0)*311.7)*43758.5453; return x-Math.floor(x); }

  window.MotionSamples = {PURPLE: PURPLE, TINT: TINT, INK: INK, INK3: INK3, INK4: INK4, players: players, ease: ease, easeInOut: easeInOut, clamp: clamp, lerp: lerp, Player: Player, rnd: rnd};
})();
