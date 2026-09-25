/* Studies 01 to 06: how a risk and a book move through arqu. */
(function(){
  "use strict";
  var S = window.MotionSamples;
  var PURPLE = S.PURPLE;
  var INK = S.INK;
  var INK4 = S.INK4;
  var players = S.players;
  var ease = S.ease;
  var easeInOut = S.easeInOut;
  var clamp = S.clamp;
  var lerp = S.lerp;
  var Player = S.Player;
  var rnd = S.rnd;

  // ================= 01 — open market: one becomes many =================
  var N1=26;
  function market(ctx,t,w,h,progressIsForward){
    var cx=w/2, cy=h/2, R=Math.min(w,h)*0.40;
    var p=ease(clamp(t,0,1));
    // connecting lines
    for(var i=0;i<N1;i++){
      var ang=i*2.39996+rnd(i,3)*0.35;                 // golden angle, slightly jittered
      var stag=clamp((p-(i/N1)*0.35)/0.65,0,1);
      var e=ease(stag);
      var rad=R*(0.25+0.75*rnd(i,1))*e + 14*e;
      var x=cx+Math.cos(ang)*rad, y=cy+Math.sin(ang)*rad*0.78;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x,y);
      ctx.strokeStyle="rgba(140,130,250,"+(0.30*e*(1-e*0.72))+")"; ctx.lineWidth=1; ctx.stroke();
    }
    // satellites
    for(var i=0;i<N1;i++){
      var ang=i*2.39996+rnd(i,3)*0.35;
      var stag=clamp((p-(i/N1)*0.35)/0.65,0,1);
      var e=ease(stag);
      var rad=R*(0.25+0.75*rnd(i,1))*e + 14*e;
      var x=cx+Math.cos(ang)*rad, y=cy+Math.sin(ang)*rad*0.78;
      var r=(5+9*rnd(i,2))*e;
      ctx.beginPath(); ctx.arc(x,y,Math.max(r,0.001),0,6.2832);
      ctx.fillStyle= (i%4===0) ? "rgba(140,130,250,"+(0.85*e)+")" : "rgba(140,130,250,"+(0.16*e)+")";
      ctx.fill();
      ctx.strokeStyle="rgba(140,130,250,"+(0.55*e)+")"; ctx.lineWidth=1.25; ctx.stroke();
    }
    // the origin
    var r0=lerp(30,17,p);
    ctx.beginPath(); ctx.arc(cx,cy,r0,0,6.2832);
    ctx.fillStyle=INK; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,r0+9+6*Math.sin(t*6.2832*2),0,6.2832);
    ctx.strokeStyle="rgba(34,31,32,"+(0.16*(1-p*0.6))+")"; ctx.lineWidth=1; ctx.stroke();
    // label
    ctx.font="300 13px -apple-system,system-ui,sans-serif"; ctx.textAlign="center";
    ctx.fillStyle="rgba(128,122,124,"+(0.9*p)+")";
    ctx.fillText(progressIsForward? "one risk → the whole market" : "the whole market → one program", cx, h-26);
  }
  Player(1,function(ctx,t,w,h){ market(ctx,t,w,h,true); },{dur:3000,ratio:0.475});

  // ================= 02 — programs: many becomes one (time reversed) =================
  Player(2,function(ctx,t,w,h){ market(ctx,1-t,w,h,false); },{dur:3000,ratio:0.475});

  // ================= 03 — scroll story: left to right =================
  var N3=9;
  Player(3,function(ctx,t,w,h){
    var midY=h*0.52, p=clamp(t,0,1);
    // baseline
    ctx.beginPath(); ctx.moveTo(w*0.06,midY); ctx.lineTo(w*0.94,midY);
    ctx.strokeStyle="rgba(34,31,32,.10)"; ctx.lineWidth=1; ctx.stroke();
    // midpoint marker — the "placed" moment
    ctx.beginPath(); ctx.moveTo(w/2,midY-58); ctx.lineTo(w/2,midY+58);
    ctx.strokeStyle="rgba(140,130,250,.35)"; ctx.setLineDash([3,5]); ctx.lineWidth=1; ctx.stroke(); ctx.setLineDash([]);
    ctx.font="300 12px -apple-system,system-ui,sans-serif"; ctx.textAlign="center";
    ctx.fillStyle="rgba(140,130,250,.8)"; ctx.fillText("placed", w/2, midY-70);

    for(var i=0;i<N3;i++){
      var off=i/N3*0.42;
      var q=clamp((p-off)/(1-0.42),0,1);
      var qe=easeInOut(q);
      var x=lerp(w*0.06, w*0.94, qe);
      var wob=Math.sin(q*6.2832+i)*(h*0.055)*(1-q*0.55);
      var y=midY+wob;
      var r=7+8*rnd(i,5);
      var filled = x>=w/2;
      var a=clamp(q*6,0,1)*clamp((1-q)*6+0.25,0,1);
      // trail
      for(var k=1;k<=5;k++){
        var tq=clamp(q-k*0.018,0,1), tqe=easeInOut(tq);
        var tx=lerp(w*0.06,w*0.94,tqe), ty=midY+Math.sin(tq*6.2832+i)*(h*0.055)*(1-tq*0.55);
        ctx.beginPath(); ctx.arc(tx,ty,r*(1-k*0.11),0,6.2832);
        ctx.fillStyle="rgba(140,130,250,"+(0.05*a*(1-k/6))+")"; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(x,y,r,0,6.2832);
      if(filled){ ctx.fillStyle="rgba(140,130,250,"+(0.9*a)+")"; ctx.fill(); }
      else { ctx.fillStyle="rgba(255,255,255,"+a+")"; ctx.fill();
             ctx.strokeStyle="rgba(34,31,32,"+(0.45*a)+")"; ctx.lineWidth=1.3; ctx.stroke(); }
    }
  },{dur:5200,ratio:0.3875});

  // link panel 3 to page scroll
  var linkBtn=document.getElementById("linkscroll"), linked=false;
  var p3canvas=document.getElementById("c3");
  linkBtn.addEventListener("click",function(){
    linked=!linked;
    linkBtn.textContent="Link to scroll: "+(linked?"on":"off");
    players[3].external=linked;
    if(linked){ players[3].stop(); onScroll(); } else { players[3].play(); }
  });
  function onScroll(){
    if(!linked) return;
    var r=p3canvas.getBoundingClientRect(), vh=window.innerHeight;
    var prog=clamp((vh-r.top)/(vh+r.height),0,1);
    players[3].set(prog);
  }
  window.addEventListener("scroll",onScroll,{passive:true});

  // ================= 04 — living background =================
  var COLS=46, ROWS=20;
  Player(4,function(ctx,t,w,h,st){
    var gx=w/(COLS+1), gy=h/(ROWS+1), ph=t*6.2832;
    for(var r=1;r<=ROWS;r++){
      for(var c=1;c<=COLS;c++){
        var bx=c*gx, by=r*gy;
        var wave=Math.sin(bx*0.012+ph)*Math.cos(by*0.02-ph*0.7)+Math.sin((bx+by)*0.008+ph*1.3)*0.5;
        var dx=wave*7, dy=Math.cos(bx*0.016-ph)*5;
        // pointer repulsion
        var px=st.pointer.x-bx, py=st.pointer.y-by, d2=px*px+py*py;
        if(d2<24000 && d2>0.01){ var d=Math.sqrt(d2), f=(1-d/155)*34; dx-=px/d*f; dy-=py/d*f; }
        var a=0.16+0.30*(wave*0.5+0.5);
        var rad=0.9+1.5*(wave*0.5+0.5);
        ctx.beginPath(); ctx.arc(bx+dx,by+dy,rad,0,6.2832);
        ctx.fillStyle= (d2<24000) ? "rgba(140,130,250,"+clamp(a+0.4,0,1)+")" : "rgba(232,228,222,"+a+")";
        ctx.fill();
      }
    }
    ctx.font="400 "+Math.round(clamp(w*0.024,19,31))+"px Georgia,serif"; ctx.textAlign="center";
    ctx.fillStyle="rgba(245,241,234,.92)";
    ctx.fillText("Sophisticated underneath. Simple on the surface.", w/2, h*0.53);
  },{dur:9000,loop:true,ratio:0.3875});

  // ================= 05 — depth =================
  var PTS=[], NP=340;
  for(var i=0;i<NP;i++){
    var y=1-(i/(NP-1))*2, rr=Math.sqrt(1-y*y), th=i*2.39996;
    PTS.push([Math.cos(th)*rr, y, Math.sin(th)*rr]);
  }
  Player(5,function(ctx,t,w,h,st){
    var cx=w/2, cy=h/2, R=Math.min(w,h)*0.40, F=2.6;
    var ay=t*6.2832 + st.pointer.dx, ax=0.38 + st.pointer.dy;
    var ca=Math.cos(ay), sa=Math.sin(ay), cb=Math.cos(ax), sb=Math.sin(ax);
    var out=[];
    for(var i=0;i<NP;i++){
      var x=PTS[i][0], y=PTS[i][1], z=PTS[i][2];
      var x1=x*ca-z*sa, z1=x*sa+z*ca;
      var y1=y*cb-z1*sb, z2=y*sb+z1*cb;
      var s=F/(F-z2);
      out.push([cx+x1*R*s, cy+y1*R*s, z2, s]);
    }
    out.sort(function(a,b){ return a[2]-b[2]; });
    for(var i=0;i<out.length;i++){
      var o=out[i], dep=(o[2]+1)/2;                 // 0 back .. 1 front
      ctx.beginPath(); ctx.arc(o[0],o[1],Math.max(0.6,1.1+2.4*dep*o[3]*0.6),0,6.2832);
      ctx.fillStyle= i%7===0 ? "rgba(140,130,250,"+(0.25+0.75*dep)+")" : "rgba(232,228,222,"+(0.07+0.5*dep)+")";
      ctx.fill();
    }
    ctx.font="300 13px -apple-system,system-ui,sans-serif"; ctx.textAlign="center";
    ctx.fillStyle="rgba(139,133,131,.85)";
    ctx.fillText("drawn by the browser — no 3D library", cx, h-24);
  },{dur:14000,loop:true,ratio:0.425});

  // ================= 06 — human in the loop =================
  var N6=16;
  Player(6,function(ctx,t,w,h){
    var y=h*0.5, x0=w*0.07, x1=w*0.93, gate=w*0.5, p=clamp(t,0,1);
    ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y);
    ctx.strokeStyle="rgba(34,31,32,.09)"; ctx.lineWidth=1; ctx.stroke();

    // the human node
    var active = p>0.30 && p<0.72;
    var pulse = active ? 1+0.14*Math.sin(p*62) : 1;
    ctx.beginPath(); ctx.arc(gate,y,26*pulse,0,6.2832);
    ctx.fillStyle=active?"rgba(140,130,250,.16)":"rgba(34,31,32,.05)"; ctx.fill();
    ctx.strokeStyle=active?"rgba(140,130,250,.85)":"rgba(34,31,32,.22)"; ctx.lineWidth=1.6; ctx.stroke();
    ctx.beginPath(); ctx.arc(gate,y-5,6.5,0,6.2832);
    ctx.fillStyle=active?PURPLE:INK4; ctx.fill();
    ctx.beginPath(); ctx.arc(gate,y+13,10.5,Math.PI,0); ctx.fillStyle=active?PURPLE:INK4; ctx.fill();

    ctx.font="300 12.5px -apple-system,system-ui,sans-serif"; ctx.textAlign="center";
    ctx.fillStyle=active?"rgba(140,130,250,.95)":"rgba(128,122,124,.7)";
    ctx.fillText(p<0.30?"incoming":(active?"a person decides":"bound"), gate, y+64);

    for(var i=0;i<N6;i++){
      var lane=(i%3-1)*16;
      var start=i/N6*0.26;
      var q=clamp((p-start)/0.26,0,1);           // approach leg
      var held = p<0.34+ (i/N6)*0.30;
      var rel = clamp((p-(0.36+(i/N6)*0.30))/0.28,0,1); // release leg
      var x, released=false;
      if(held){ x=lerp(x0, gate-34-((i%5)*11), easeInOut(q)); }
      else { x=lerp(gate-34-((i%5)*11), x1, ease(rel)); released=rel>0.02; }
      var a=clamp(q*5,0,1);
      var r=5.5+3*rnd(i,7);
      ctx.beginPath(); ctx.arc(x,y+lane*(held?1:1-ease(rel)),r,0,6.2832);
      if(released){ ctx.fillStyle="rgba(140,130,250,"+a+")"; ctx.fill(); }
      else { ctx.fillStyle="rgba(255,255,255,"+a+")"; ctx.fill();
             ctx.strokeStyle="rgba(34,31,32,"+(0.4*a)+")"; ctx.lineWidth=1.3; ctx.stroke(); }
    }
  },{dur:7000,ratio:0.35});

})();
