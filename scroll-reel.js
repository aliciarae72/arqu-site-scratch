/* Drawings 06 to 11: the motion reel, driven by scroll position. */
(function(){
'use strict';
var S = window.ScrollStudy;
var clamp = S.clamp;
var Player = S.Player;
var INK = S.INK;
var PUR2 = S.PUR2;

/* ── folded in from the motion reel, 2026-09-15 ──────────────────
   Panels 1, 2, 4, 5, 6 and 10, refined so every one is driven by
   scroll position instead of a timer. The ambient three used to run
   on a clock; on this page nothing autoplays, so their phase comes
   from t and they rewind when you scroll back.                      */
function easeOut3(t){ return 1-Math.pow(1-t,3); }
function easeInOut3(t){ return t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
function lerp(a,b,t){ return a+(b-a)*t; }
function rnd2(i,s){ var x=Math.sin(i*127.1+(s||0)*311.7)*43758.5453; return x-Math.floor(x); }
var TAU=6.2832;

/* 06/07 — open market. One drawing, played forward and reversed. */
var N1=26;
function market(ctx,t,w,h,forward){
  var cx=w/2, cy=h/2, R=Math.min(w,h)*0.40, p=easeOut3(clamp(t,0,1)), i;
  for(i=0;i<N1;i++){
    var ang=i*2.39996+rnd2(i,3)*0.35;
    var e=easeOut3(clamp((p-(i/N1)*0.35)/0.65,0,1));
    var rad=R*(0.25+0.75*rnd2(i,1))*e + 14*e;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.lineTo(cx+Math.cos(ang)*rad, cy+Math.sin(ang)*rad*0.78);
    ctx.strokeStyle="rgba(140,130,250,"+(0.30*e*(1-e*0.72))+")"; ctx.lineWidth=1; ctx.stroke();
  }
  for(i=0;i<N1;i++){
    var ang2=i*2.39996+rnd2(i,3)*0.35;
    var e2=easeOut3(clamp((p-(i/N1)*0.35)/0.65,0,1));
    var rad2=R*(0.25+0.75*rnd2(i,1))*e2 + 14*e2;
    var x=cx+Math.cos(ang2)*rad2, y=cy+Math.sin(ang2)*rad2*0.78;
    var r=(5+9*rnd2(i,2))*e2;
    ctx.beginPath(); ctx.arc(x,y,Math.max(r,0.001),0,TAU);
    ctx.fillStyle=(i%4===0)?"rgba(140,130,250,"+(0.85*e2)+")":"rgba(140,130,250,"+(0.16*e2)+")";
    ctx.fill();
    ctx.strokeStyle="rgba(140,130,250,"+(0.55*e2)+")"; ctx.lineWidth=1.25; ctx.stroke();
  }
  var r0=lerp(30,17,p);
  ctx.beginPath(); ctx.arc(cx,cy,r0,0,TAU); ctx.fillStyle=INK; ctx.fill();
  ctx.beginPath(); ctx.arc(cx,cy,r0+9+6*Math.sin(t*TAU*2),0,TAU);
  ctx.strokeStyle="rgba(34,31,32,"+(0.16*(1-p*0.6))+")"; ctx.lineWidth=1; ctx.stroke();
  ctx.font="300 13px -apple-system,system-ui,sans-serif"; ctx.textAlign="center";
  ctx.fillStyle="rgba(128,122,124,"+(0.9*p)+")";
  ctx.fillText(forward?"one risk → the whole market":"the whole market → one program", cx, h-26);
}
Player('c-one','s-one',function(ctx,t,w,h){ market(ctx,t,w,h,true); });
Player('c-many','s-many',function(ctx,t,w,h){ market(ctx,1-t,w,h,false); });

/* 08 — living background. Phase from scroll; the cursor still parts it. */
var COLS=46, ROWS=20;
Player('c-field','s-field',function(ctx,t,w,h,st){
  var gx=w/(COLS+1), gy=h/(ROWS+1), ph=t*TAU*1.4;
  for(var r=1;r<=ROWS;r++){
    for(var c=1;c<=COLS;c++){
      var bx=c*gx, by=r*gy;
      var wave=Math.sin(bx*0.012+ph)*Math.cos(by*0.02-ph*0.7)+Math.sin((bx+by)*0.008+ph*1.3)*0.5;
      var dx=wave*7, dy=Math.cos(bx*0.016-ph)*5;
      var px=st.px-bx, py=st.py-by, d2=px*px+py*py;
      if(d2<24000 && d2>0.01){ var d=Math.sqrt(d2), f=(1-d/155)*34; dx-=px/d*f; dy-=py/d*f; }
      var a=0.16+0.30*(wave*0.5+0.5);
      ctx.beginPath(); ctx.arc(bx+dx,by+dy,0.9+1.5*(wave*0.5+0.5),0,TAU);
      ctx.fillStyle=(d2<24000)?"rgba(140,130,250,"+clamp(a+0.4,0,1)+")":"rgba(215,210,204,"+a+")";
      ctx.fill();
    }
  }
  ctx.font="400 "+Math.round(clamp(w*0.024,19,31))+"px Georgia,serif"; ctx.textAlign="center";
  ctx.fillStyle="rgba(34,31,32,.72)";
  ctx.fillText("Sophisticated underneath. Simple on the surface.", w/2, h*0.53);
}, true);

/* 09 — depth. Scroll spins it, the pointer tilts it. */
var PTS=[], NP=340;
for(var _i=0;_i<NP;_i++){
  var _y=1-(_i/(NP-1))*2, _rr=Math.sqrt(1-_y*_y), _th=_i*2.39996;
  PTS.push([Math.cos(_th)*_rr, _y, Math.sin(_th)*_rr]);
}
Player('c-depth','s-depth',function(ctx,t,w,h,st){
  var cx=w/2, cy=h/2, R=Math.min(w,h)*0.40, F=2.6, i;
  var ay=t*TAU + (st.px/w-0.5)*1.2, ax=0.38 + (st.py/h-0.5)*0.8;
  var ca=Math.cos(ay), sa=Math.sin(ay), cb=Math.cos(ax), sb=Math.sin(ax);
  var out=[];
  for(i=0;i<NP;i++){
    var x=PTS[i][0], y=PTS[i][1], z=PTS[i][2];
    var x1=x*ca-z*sa, z1=x*sa+z*ca;
    var y1=y*cb-z1*sb, z2=y*sb+z1*cb;
    var s=F/(F-z2);
    out.push([cx+x1*R*s, cy+y1*R*s, z2, s]);
  }
  out.sort(function(a,b){ return a[2]-b[2]; });
  for(i=0;i<out.length;i++){
    var o=out[i], dep=(o[2]+1)/2;
    ctx.beginPath(); ctx.arc(o[0],o[1],Math.max(0.6,1.1+2.4*dep*o[3]*0.6),0,TAU);
    ctx.fillStyle= i%7===0 ? "rgba(140,130,250,"+(0.25+0.75*dep)+")" : "rgba(232,228,222,"+(0.07+0.5*dep)+")";
    ctx.fill();
  }
  ctx.font="300 13px -apple-system,system-ui,sans-serif"; ctx.textAlign="center";
  ctx.fillStyle="rgba(180,176,174,.85)";
  ctx.fillText("drawn by the browser — no 3D library", cx, h-24);
}, true);

/* 10 — human in the loop. Already pure in t; unchanged but for the lane width. */
var N6=16;
Player('c-gate','s-gate',function(ctx,t,w,h){
  var y=h*0.5, x0=w*0.07, x1=w*0.93, gate=w*0.5, p=clamp(t,0,1);
  ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y);
  ctx.strokeStyle="rgba(34,31,32,.09)"; ctx.lineWidth=1; ctx.stroke();
  var active = p>0.30 && p<0.72;
  var pulse = active ? 1+0.14*Math.sin(p*62) : 1;
  ctx.beginPath(); ctx.arc(gate,y,26*pulse,0,TAU);
  ctx.fillStyle=active?"rgba(140,130,250,.16)":"rgba(34,31,32,.05)"; ctx.fill();
  ctx.strokeStyle=active?"rgba(140,130,250,.85)":"rgba(34,31,32,.22)"; ctx.lineWidth=1.6; ctx.stroke();
  ctx.beginPath(); ctx.arc(gate,y-5,6.5,0,TAU);
  ctx.fillStyle=active?PUR2:'#b8b3b4'; ctx.fill();
  ctx.beginPath(); ctx.arc(gate,y+13,10.5,Math.PI,0); ctx.fillStyle=active?PUR2:'#b8b3b4'; ctx.fill();
  ctx.font="300 12.5px -apple-system,system-ui,sans-serif"; ctx.textAlign="center";
  ctx.fillStyle=active?"rgba(140,130,250,.95)":"rgba(128,122,124,.7)";
  ctx.fillText(p<0.30?"incoming":(active?"a person decides":"bound"), gate, y+64);
  for(var i=0;i<N6;i++){
    var lane=(i%3-1)*16;
    var q=clamp((p-i/N6*0.26)/0.26,0,1);
    var held = p<0.34+(i/N6)*0.30;
    var rel = clamp((p-(0.36+(i/N6)*0.30))/0.28,0,1);
    var x, released=false;
    if(held){ x=lerp(x0, gate-34-((i%5)*11), easeInOut3(q)); }
    else { x=lerp(gate-34-((i%5)*11), x1, easeOut3(rel)); released=rel>0.02; }
    var a=clamp(q*5,0,1), r=5.5+3*rnd2(i,7);
    ctx.beginPath(); ctx.arc(x, y+lane*(held?1:1-easeOut3(rel)), r, 0, TAU);
    if(released){ ctx.fillStyle="rgba(140,130,250,"+a+")"; ctx.fill(); }
    else { ctx.fillStyle="rgba(255,255,255,"+a+")"; ctx.fill();
           ctx.strokeStyle="rgba(34,31,32,"+(0.4*a)+")"; ctx.lineWidth=1.3; ctx.stroke(); }
  }
});

/* 11 — aurora wash. Drift comes off the scroll, so it rewinds too. */
Player('c-aurora','s-aurora',function(ctx,t,w,h){
  ctx.fillStyle="#151213"; ctx.fillRect(0,0,w,h);
  for(var i=0;i<7;i++){
    var ph=rnd2(i,51);
    var x=w*(0.10+0.80*rnd2(i,52))+Math.sin(TAU*(t+ph))*w*0.11;
    var y=h*(0.24+0.52*rnd2(i,53))+Math.cos(TAU*(t*0.8+ph))*h*0.15;
    var rx=w*(0.17+rnd2(i,54)*0.21);
    ctx.save(); ctx.translate(x,y);
    ctx.rotate(Math.sin(TAU*(t*0.5+ph))*0.34);
    ctx.scale(1,0.30+rnd2(i,55)*0.24);
    var g=ctx.createRadialGradient(0,0,0,0,0,rx);
    g.addColorStop(0,"rgba(140,130,250,0.21)");
    g.addColorStop(0.5,"rgba(140,130,250,0.075)");
    g.addColorStop(1,"rgba(140,130,250,0)");
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,rx,0,TAU); ctx.fill(); ctx.restore();
  }
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.font="400 "+Math.max(20,w*0.033)+'px Georgia,serif';
  ctx.fillStyle="rgba(245,241,234,.82)";
  ctx.fillText("Tell us about the risk.", w/2, h*0.52);
  ctx.textBaseline="alphabetic";
});

})();
