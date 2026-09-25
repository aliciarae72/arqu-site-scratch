/* Studies 09 to 11: ambient backgrounds. */
(function(){
  "use strict";
  var S = window.MotionSamples;
  var Player = S.Player;
  var rnd = S.rnd;

  // ================= 09 — drifting field (ambient, light) =================
  Player(9,function(ctx,t,w,h){
    var TAU=6.2832;
    for(var i=0;i<16;i++){
      var ph=rnd(i,41), sp=0.5+rnd(i,42)*0.8;
      var x=(-0.08+1.16*rnd(i,43))*w + Math.sin(TAU*(t*sp+ph))*w*0.055;
      var y=(-0.05+1.10*rnd(i,44))*h + Math.cos(TAU*(t*sp*0.66+ph))*h*0.11;
      var rx=w*(0.07+rnd(i,45)*0.14), k=0.46+rnd(i,46)*0.34;
      var a=0.045+rnd(i,47)*0.075;
      ctx.save(); ctx.translate(x,y); ctx.rotate((rnd(i,48)-0.5)*0.9); ctx.scale(1,k);
      var g=ctx.createRadialGradient(0,0,0,0,0,rx);
      g.addColorStop(0,"rgba(140,130,250,"+a+")");
      g.addColorStop(0.62,"rgba(140,130,250,"+(a*0.42)+")");
      g.addColorStop(1,"rgba(140,130,250,0)");
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,rx,0,TAU); ctx.fill(); ctx.restore();
    }
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.font="400 "+Math.max(21,w*0.036)+'px "DM Serif Display",Georgia,serif';
    ctx.fillStyle="rgba(34,31,32,.86)";
    ctx.fillText("Innovate beyond the ask.",w/2,h*0.50);
  },{dur:28000,loop:true,ratio:0.32});

  // ================= 10 — aurora wash (ambient, dark) =================
  Player(10,function(ctx,t,w,h){
    var TAU=6.2832;
    ctx.fillStyle="#151213"; ctx.fillRect(0,0,w,h);
    for(var i=0;i<7;i++){
      var ph=rnd(i,51);
      var x=w*(0.10+0.80*rnd(i,52))+Math.sin(TAU*(t+ph))*w*0.11;
      var y=h*(0.24+0.52*rnd(i,53))+Math.cos(TAU*(t*0.8+ph))*h*0.15;
      var rx=w*(0.17+rnd(i,54)*0.21);
      ctx.save(); ctx.translate(x,y);
      ctx.rotate(Math.sin(TAU*(t*0.5+ph))*0.34);
      ctx.scale(1,0.30+rnd(i,55)*0.24);
      var g=ctx.createRadialGradient(0,0,0,0,0,rx);
      g.addColorStop(0,"rgba(140,130,250,0.21)");
      g.addColorStop(0.5,"rgba(140,130,250,0.075)");
      g.addColorStop(1,"rgba(140,130,250,0)");
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,rx,0,TAU); ctx.fill(); ctx.restore();
    }
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.font="400 "+Math.max(20,w*0.033)+'px "DM Serif Display",Georgia,serif';
    ctx.fillStyle="rgba(245,241,234,.82)";
    ctx.fillText("Tell us about the risk.",w/2,h*0.52);
  },{dur:32000,loop:true,ratio:0.32});

  // ================= 11 — ruled breath (ambient, paper) =================
  Player(11,function(ctx,t,w,h){
    var TAU=6.2832, rows=20;
    for(var i=0;i<rows;i++){
      var y=Math.round(h*(0.10+0.80*i/(rows-1)))+0.5;
      var ph=i/rows;
      var sw=(Math.sin(TAU*(t-ph*0.6))+1)/2;
      var inset=w*(0.055+0.018*Math.sin(TAU*(t*0.5+ph)));
      ctx.beginPath(); ctx.moveTo(inset,y); ctx.lineTo(w-inset,y);
      ctx.lineWidth=0.8+sw*1.4;
      ctx.strokeStyle="rgba(34,31,32,"+(0.055+sw*0.125)+")"; ctx.stroke();
      if(sw>0.90){
        var mx=inset+(w-2*inset)*(((t*0.9+ph)%1));
        ctx.beginPath(); ctx.arc(mx,y,2.7,0,TAU);
        ctx.fillStyle="rgba(140,130,250,"+((sw-0.90)/0.10*0.8)+")"; ctx.fill();
      }
    }
  },{dur:20000,loop:true,ratio:0.30});


})();
