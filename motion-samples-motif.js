/* Studies 07 and 08: the ellipsis-into-line mark. */
(function(){
  "use strict";
  var S = window.MotionSamples;
  var PURPLE = S.PURPLE;
  var clamp = S.clamp;
  var Player = S.Player;

  // ================= 07 — ellipsis into line (THE motif, horizontal) =================
  // brand.css .elr — "3 dots, 8px apart, then the line takes over. Meaning is constant."
  // Once per panel, never as a divider. Do not tile it.
  function brandEase(x){                    // cubic-bezier(.2,.7,.2,1), Newton on the x-polynomial
    if(x<=0) return 0; if(x>=1) return 1;
    var t=x, p1=0.2, p2=0.2, i, u, fx, dx;
    for(i=0;i<6;i++){
      u=1-t;
      fx=3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t - x;
      dx=3*u*u*p1 + 6*u*t*(p2-p1) + 3*t*t*(1-p2);
      if(dx<1e-6) break;
      t-=fx/dx;
    }
    var v=1-t;
    return 3*v*v*t*0.7 + 3*v*t*t*1.0 + t*t*t;
  }
  var LINE7="the part that used to get dropped";
  var ELR_DELAY=[0.10,0.28,0.46];           // the brand stagger, in seconds

  Player(7,function(ctx,t,w,h){
    var sec=clamp(t,0,1)*2.9;               // 2.9s of real time across the scrub
    var cy=h*0.64, fs=Math.max(17,w*0.040), x0=w*0.14;

    // the heading the motif resolves under (.elr--under)
    ctx.textAlign="left"; ctx.textBaseline="alphabetic";
    ctx.font="400 "+fs+'px "DM Serif Display",Georgia,serif';
    ctx.fillStyle="rgba(34,31,32,"+(0.20+0.72*brandEase(clamp(sec/0.50,0,1)))+")";
    ctx.fillText(LINE7,x0,cy-fs*0.90);

    // three dots, 8px apart at brand scale, staggered so it reads as a sequence not a flash
    var r=Math.max(2.2,w*0.0030), gap=r*8;
    for(var i=0;i<3;i++){
      var a=brandEase(clamp((sec-ELR_DELAY[i])/0.30,0,1));
      if(a<=0) continue;
      ctx.beginPath(); ctx.arc(x0+i*gap, cy, r*(0.55+0.45*a), 0, 6.2832);
      ctx.fillStyle="rgba(140,130,250,"+(0.95*a)+")"; ctx.fill();
    }

    // then the line takes over — 1.15s — and keeps going, off the right edge
    var ls=ELR_DELAY[2]+0.30;
    var d=brandEase(clamp((sec-ls)/1.15,0,1));
    if(d>0){
      var lx=x0+2*gap+r*1.8, lend=lx+(w*1.06-lx)*d;
      ctx.beginPath(); ctx.moveTo(lx,cy); ctx.lineTo(lend,cy);
      ctx.strokeStyle=PURPLE; ctx.lineWidth=Math.max(1.4,r*0.85);
      ctx.lineCap="butt"; ctx.stroke();
    }
  },{dur:2900,ratio:0.32});

  // ================= 08 — the same motif, vertical (route-02) =================
  // "Three dots, then a line that keeps going." preserveAspectRatio:none pulls the dots apart.
  Player(8,function(ctx,t,w,h){
    var sec=clamp(t,0,1)*3.2;
    var cx=w*0.50, y0=h*0.13;
    var r=Math.max(2.2,w*0.0030), gap=r*8*2.6;   // stretched, the way the vertical route stretches it
    for(var i=0;i<3;i++){
      var a=brandEase(clamp((sec-ELR_DELAY[i])/0.30,0,1));
      if(a<=0) continue;
      ctx.beginPath(); ctx.arc(cx, y0+i*gap, r*(0.55+0.45*a), 0, 6.2832);
      ctx.fillStyle="rgba(140,130,250,"+(0.95*a)+")"; ctx.fill();
    }
    var ls=ELR_DELAY[2]+0.30;
    var d=brandEase(clamp((sec-ls)/1.15,0,1));
    if(d>0){
      var ly=y0+2*gap+r*1.8, lend=ly+(h*1.10-ly)*d;
      ctx.beginPath(); ctx.moveTo(cx,ly); ctx.lineTo(cx,lend);
      ctx.strokeStyle=PURPLE; ctx.lineWidth=Math.max(1.4,r*0.85);
      ctx.lineCap="butt"; ctx.stroke();
    }
  },{dur:3200,ratio:0.62});

})();
