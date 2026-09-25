/* Drawings 00 to 05: the scroll story, from the mark to the line that keeps going. */
(function(){
'use strict';
var S = window.ScrollStudy;
var brandEase = S.brandEase;
var rnd = S.rnd;
var sub = S.sub;
var Player = S.Player;
var INK = S.INK;
var INK2 = S.INK2;
var INK3 = S.INK3;
var LINE = S.LINE;
var PUR = S.PUR;
var PUR2 = S.PUR2;
var TINT = S.TINT;

/* 00 — the motif itself, drawn at scroll pace */
Player('c-open','s-open',function(ctx,t,w,h){
  var cy = h/2, r = Math.max(3, h*0.022), gap = r*8;
  var x0 = w*0.16;
  var stag = [0, .18/1.6, .36/1.6];
  for(var i=0;i<3;i++){
    var dt = sub(t, stag[i], stag[i]+0.22);
    if(dt<=0) continue;
    var e = brandEase(dt);
    ctx.globalAlpha = e;
    ctx.fillStyle = PUR;
    ctx.beginPath(); ctx.arc(x0 + i*gap, cy, r*e, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  var lt = sub(t, .34, 1);
  if(lt>0){
    var start = x0 + 2*gap + gap*0.7;
    var end = start + (w - start + 60) * brandEase(lt);
    ctx.strokeStyle = PUR; ctx.lineWidth = Math.max(1.5, h*0.008); ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(start, cy); ctx.lineTo(end, cy); ctx.stroke();
  }
});

/* 01 — the submission arriving: mail, attachments, rows */
Player('c-arrives','s-arrives',function(ctx,t,w,h){
  var pad = w*0.07, cardW = w*0.26, cardH = h*0.30, cy = h*0.5;
  var labels = ['Email', 'Attachments', 'Schedule of values'];
  for(var i=0;i<3;i++){
    var dt = sub(t, i*0.16, i*0.16 + 0.40);
    if(dt<=0) continue;
    var e = brandEase(dt);
    var tx = pad + i*(cardW + w*0.035);
    var ty = cy - cardH/2 + (1-e)*h*0.16;
    ctx.globalAlpha = e;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(tx, ty, cardW, cardH, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PUR; ctx.fillRect(tx+14, ty+15, cardW*0.22*e, 3);
    ctx.fillStyle = INK3;
    for(var k=0;k<3;k++){
      var rw = cardW*(0.62 - k*0.13)*e;
      ctx.globalAlpha = e*(0.5 - k*0.1);
      ctx.fillRect(tx+14, ty+32+k*11, rw, 2.5);
    }
    ctx.globalAlpha = e;
    ctx.font = '600 10px Lato, sans-serif';
    ctx.fillStyle = INK2;
    ctx.fillText(labels[i], tx+14, ty+cardH-13);
  }
  ctx.globalAlpha = 1;
  /* the line arrives underneath and gathers them */
  var lt = sub(t, .55, 1);
  if(lt>0){
    ctx.strokeStyle = PUR; ctx.lineWidth = 1.75; ctx.lineCap='round';
    var y = cy + cardH/2 + h*0.12;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + (w-pad*0.6-pad)*brandEase(lt), y); ctx.stroke();
  }
});

/* 02 — open market fanning out */
Player('c-market','s-market',function(ctx,t,w,h){
  var ox = w*0.14, oy = h*0.5, N = 14;
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  for(var i=0;i<N;i++){
    var dt = sub(t, i*0.035, i*0.035+0.45);
    if(dt<=0) continue;
    var ee = brandEase(dt);
    var spread = (i/(N-1) - 0.5) * h*0.72 * ee;
    var tx = ox + (w*0.70) * ee;
    var ty = oy + spread;
    ctx.globalAlpha = 0.30 + 0.45*ee;
    ctx.strokeStyle = i===4 ? PUR2 : LINE;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.bezierCurveTo(ox + w*0.26, oy, tx - w*0.22, ty, tx, ty);
    ctx.stroke();
    ctx.globalAlpha = ee;
    ctx.fillStyle = i===4 ? PUR : '#cdc8c0';
    ctx.beginPath(); ctx.arc(tx, ty, i===4 ? 5 : 3.2, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ox, oy, 6, 0, Math.PI*2); ctx.fill();
  ctx.font = '700 10px Lato, sans-serif'; ctx.fillStyle = INK3;
  ctx.fillText('THE RISK', ox - 22, oy + h*0.16);
  if(t > .72){
    ctx.globalAlpha = sub(t,.72,1);
    ctx.fillStyle = PUR; ctx.font = '700 10px Lato, sans-serif';
    ctx.fillText('THE ONE YOU’D HAVE CALLED', ox + w*0.70 - 60, oy + (4/(N-1)-0.5)*h*0.72 - 14);
    ctx.globalAlpha = 1;
  }
});

/* 03 — the tower building */
Player('c-tower','s-tower',function(ctx,t,w,h){
  var bx = w*0.30, bw = w*0.40, base = h*0.86, layers = 4;
  var lh = (base - h*0.14) / layers;
  var names = ['Primary', '1st excess', '2nd excess', 'Cat layer'];
  for(var i=0;i<layers;i++){
    var dt = sub(t, i*0.20, i*0.20+0.40);
    if(dt<=0) continue;
    var e = brandEase(dt);
    var y = base - (i+1)*lh;
    var drop = (1-e) * h*0.22;
    ctx.globalAlpha = e;
    ctx.fillStyle = i===0 ? TINT : '#fff';
    ctx.strokeStyle = i===0 ? PUR2 : LINE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, y - drop, bw, lh-8, 7); ctx.fill(); ctx.stroke();
    ctx.font = '600 11px Lato, sans-serif'; ctx.fillStyle = INK2;
    ctx.fillText(names[i], bx + 14, y - drop + lh*0.55);
    ctx.fillStyle = INK3; ctx.font = '11px Lato, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('$' + (5 * Math.pow(2,i)) + 'M', bx + bw - 14, y - drop + lh*0.55);
    ctx.textAlign = 'left';
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w*0.14, base+2); ctx.lineTo(w*0.86, base+2); ctx.stroke();
});

/* 04 — the hand comes in over the machine's work */
Player('c-human','s-human',function(ctx,t,w,h){
  var rows = 6, top = h*0.18, rh = (h*0.64)/rows, x = w*0.16, rw = w*0.52;
  for(var i=0;i<rows;i++){
    var dt = sub(t, i*0.05, i*0.05+0.30);
    var e = brandEase(dt);
    ctx.globalAlpha = 0.20 + 0.45*e;
    ctx.fillStyle = '#7a7684';
    ctx.fillRect(x, top + i*rh, rw*(0.55 + rnd(i,3)*0.4)*e, 4);
  }
  ctx.globalAlpha = 1;
  /* the correction: an ellipse drawn by hand around row 3, fixed wobble */
  var ht = sub(t, .42, .92);
  if(ht>0){
    var e = brandEase(ht);
    var cx = x + rw*0.34, cy = top + 3*rh + 2, rx = rw*0.30, ry = rh*0.85;
    ctx.strokeStyle = PUR2; ctx.lineWidth = 2; ctx.lineCap='round';
    ctx.beginPath();
    var steps = 90, span = Math.PI*2.18*e;
    for(var s=0;s<=steps*e;s++){
      var a = -0.6 + (s/steps)*Math.PI*2.18;
      if(a > -0.6 + span) break;
      var wob = 1 + (rnd(s,7)-0.5)*0.055;
      var px = cx + Math.cos(a)*rx*wob, py = cy + Math.sin(a)*ry*wob;
      if(s===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.stroke();
  }
  var nt = sub(t, .80, 1);
  if(nt>0){
    ctx.globalAlpha = brandEase(nt);
    ctx.fillStyle = '#b9b4b0'; ctx.font = '600 11px Lato, sans-serif';
    ctx.fillText('“TIV is stale — use the 2026 SOV”', x + rw*0.70, top + 3*rh + 6);
    ctx.globalAlpha = 1;
  }
});

/* 05 — and it keeps going */
Player('c-line','s-line',function(ctx,t,w,h){
  var cy = h/2, r = Math.max(3,h*0.02), gap = r*8, x0 = w*0.10;
  for(var i=0;i<3;i++){
    var dt = sub(t, i*0.07, i*0.07+0.20);
    if(dt<=0)continue;
    var e = brandEase(dt);
    ctx.globalAlpha = e; ctx.fillStyle = PUR;
    ctx.beginPath(); ctx.arc(x0+i*gap, cy, r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  var lt = sub(t,.26,1);
  if(lt>0){
    var start = x0 + 2*gap + gap*0.7;
    ctx.strokeStyle = PUR; ctx.lineWidth = Math.max(1.5,h*0.007); ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(start, cy);
    ctx.lineTo(start + (w-start+120)*brandEase(lt), cy); ctx.stroke();
  }
});

})();
