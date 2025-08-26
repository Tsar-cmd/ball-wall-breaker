"use strict";
    var laneW=420,laneH=560,START_PAD=90,BLK_H=92,FINISH_H=34,BORDER=3,TIME_SCALE=0.4;
    var ctxLeft=document.getElementById('laneLeft').getContext('2d');
    var ctxRight=document.getElementById('laneRight').getContext('2d');
    var hudLeft=document.getElementById('hudLeft');
    var hudRight=document.getElementById('hudRight');
    var winnerEl=document.getElementById('winner');
    var btnToggle=document.getElementById('btnToggle');
    var btnRestart=document.getElementById('btnRestart');
    var btnMenu=document.getElementById('btnMenu');
    var menu=document.getElementById('menu');
    var separateChk=document.getElementById('separateChk');
    var sepBlock=document.getElementById('sepBlock');
    var hpTop1=document.getElementById('hpTop1');
    var hpMid1=document.getElementById('hpMid1');
    var hpBot1=document.getElementById('hpBot1');
    var hpTop2=document.getElementById('hpTop2');
    var hpMid2=document.getElementById('hpMid2');
    var hpBot2=document.getElementById('hpBot2');
    var applyStart=document.getElementById('applyStart');
    var typeLeftSel=document.getElementById('typeLeftSel');
    var typeRightSel=document.getElementById('typeRightSel');
    var tabNormal=document.getElementById('tabNormal');
    var tabHybrids=document.getElementById('tabHybrids');

    function hexToRgb(h){
      h=String(h||'').replace('#','');
      if(h.length===3){ h=h.split('').map(function(c){return c+c}).join('') }
      var n=parseInt(h,16); if(!isFinite(n)) n=0xFFFFFF;
      return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
    }
    function rgbToCss(c){ return 'rgb('+Math.round(c.r)+','+Math.round(c.g)+','+Math.round(c.b)+')' }
    function mixRGB(a,b,t){ return { r:a.r+(b.r-a.r)*t, g:a.g+(b.g-a.g)*t, b:a.b+(b.b-a.b)*t } }
    function tintColor(ball){ if(ball&&ball.type==='hybrid'){ return mixRGB(hexToRgb('#8b5a2b'),hexToRgb('#cf2e2e'),0.5) } return hexToRgb(ball&&ball.color?ball.color:'#000') }

    var TYPES={
      strong:{color:'#8b5a2b',kind:'strong'},
      fast:{color:'#cf2e2e',kind:'fast'},
      hybrid:{kind:'hybrid'},
      growing:{color:'#f2d200',kind:'growing'},
      laser:{color:'#1abc9c',kind:'laser'},
      gravitron:{color:'#9b59b6',kind:'gravitron'},
      duplicator:{color:'#ff66cc',kind:'duplicator'},
      sticky:{color:'#00cfe8',kind:'sticky'}
    };
    var NORMAL_TYPES=[
      {value:'strong',label:'Сильный (коричневый)'},
      {value:'fast',label:'Быстрый (красный)'},
      {value:'growing',label:'Растущий (жёлтый)'},
      {value:'laser',label:'Лазерный (зелёный)'},
      {value:'gravitron',label:'Гравитрон (фиолетовый)'},
      {value:'duplicator',label:'Дупликатор (розовый)'},
      {value:'sticky',label:'Липкий (циановый)'}
    ];
    var HYBRID_TYPES=[ {value:'hybrid',label:'Гибрид (сильный+быстрый)'} ];

    function clampHP(v){ v=Math.floor(Number(v)||0); return v<0?0:v }

    var config={ left:{top:100,mid:250,bot:500,type:'strong'}, right:{top:100,mid:250,bot:500,type:'fast'}, separate:false, configured:false };

    function hpArrays(){ var L=[config.left.top,config.left.mid,config.left.bot]; var R=config.separate?[config.right.top,config.right.mid,config.right.bot]:L.slice(); return [L,R] }

    function makeBlocks(HPs){
      var gap=6, blocks=[], y=START_PAD;
      for(var i=0;i<3;i++){
        var hp=HPs[i];
        blocks.push({x:BORDER,y:y,w:laneW-2*BORDER,h:BLK_H,hp:hp,max:hp,broken:false});
        y+=BLK_H+gap;
      }
      return blocks;
    }

    function baseBallFor(type){
      var isSpeedy=(type==='fast'||type==='hybrid');
      var dir=(Math.random()<0.5?-1:1);
      var startX=laneW/2+(Math.random()*40-20);
      var t=TYPES[type]||TYPES.strong;
      var baseVx=isSpeedy?2*dir:3*dir;
      var b={ type:t.kind,x:startX,y:44,r:14,color:(t.color||'#000'),vx:baseVx,vy:0,g:0.45,damage:1,dirX:(baseVx>=0?1:-1),dirY:1,growRatePS:(type==='growing'?2:0),finished:false,timeToFinish:null,popping:false,popProg:0,popped:false };
      if(type==='fast'||type==='hybrid'){ b.spd=Math.max(2,Math.abs(baseVx)); b.spdAccel=0.008; b.spdAccelK=0.0013333333 }
      if(type==='laser'){ b.color='#1abc9c'; b.laserAngle=-Math.PI/2; b.laserAngVel=1.5; b.laserTimer=0; b.laserInterval=0.25; b.laserDamage=1; b.laserHits=0; b.lastLaserBlockIdx=-1; b.laserTierHits=0; b.g=0.5 }
      if(type==='gravitron'){ b.color='#9b59b6'; b.g=0.42; b.gIncPS=0.08; b.gK=0.08; b.gBounceInc=0.02 }
      if(type==='duplicator'){ b.color='#ff66cc'; b.dupEvery=5; b.dupTimer=0; b.g=0.5 }
      if(type==='growing'){ b.g=0.5 }
      if(type==='sticky'){ b.color='#00cfe8'; b.g=0.5; b.stickInterval=0.05; b.stickHitsTarget=1; b.stickHitsDone=0; b.sticking=false; b.stickBlockIdx=-1; b.stickTimer=0; b.stickKeepVX=b.vx }
      return b;
    }

    function makeLane(ctx,HPs,type){ return { ctx:ctx, blocks:makeBlocks(HPs), balls:[baseBallFor(type)], laserRays:[] } }

    var lanes=[], isRunning=false, isPaused=false, winner=null, startTime=0, raf, lastTime=0, dtSec=0, currentCategory='normal';

    function updateToggle(){ btnToggle.textContent=(!isRunning||isPaused)?'▶️ Старт':'⏸️ Стоп' }
    function setType(side,val){ if(side==='left'){config.left.type=val}else{config.right.type=val} refreshTypeUI() }
    function refreshTypeUI(){ if(typeLeftSel){typeLeftSel.value=config.left.type} if(typeRightSel){typeRightSel.value=config.right.type} }
    function typeCategory(t){ return t==='hybrid'?'hybrids':'normal' }
    function setActiveTab(){ tabNormal.classList.toggle('active',currentCategory==='normal'); tabHybrids.classList.toggle('active',currentCategory==='hybrids') }
    function fillSelect(sel,opts,preferred){ var html=''; for(var i=0;i<opts.length;i++){ var o=opts[i]; html+='<option value="'+o.value+'">'+o.label+'</option>' } sel.innerHTML=html; if(preferred){ var found=opts.some(function(o){return o.value===preferred}); sel.value=found?preferred:opts[0].value } else { sel.value=opts[0].value } }
    function repopulateSelects(){ var list=currentCategory==='hybrids'?HYBRID_TYPES:NORMAL_TYPES; fillSelect(typeLeftSel,list,config.left.type); fillSelect(typeRightSel,list,config.right.type) }

    function showMenu(show){
      if(show){
        hpTop1.value=config.left.top; hpMid1.value=config.left.mid; hpBot1.value=config.left.bot;
        separateChk.checked=config.separate; sepBlock.classList.toggle('hidden',!config.separate);
        hpTop2.value=config.right.top; hpMid2.value=config.right.mid; hpBot2.value=config.right.bot;
        currentCategory=typeCategory(config.left.type); setActiveTab(); repopulateSelects(); refreshTypeUI();
      }
      menu.style.display=show?'flex':'none';
    }

    function reset(){
      cancelAnimationFrame(raf); isRunning=false; isPaused=false; winner=null;
      winnerEl.textContent='Победитель: —';
      var HP=hpArrays();
      lanes=[ makeLane(ctxLeft,HP[0],config.left.type), makeLane(ctxRight,HP[1],config.right.type) ];
      drawAll(); refreshHUD(); lastTime=performance.now(); updateToggle();
    }
    function start(){
      if(!config.configured){ showMenu(true); return }
      if(winner!==null){ reset() }
      if(isRunning&&!isPaused){ return }
      isPaused=false; if(!isRunning){ isRunning=true; startTime=performance.now() }
      lastTime=performance.now(); updateToggle(); loop();
    }
    function stop(){ if(!isRunning||isPaused){return} isPaused=true; cancelAnimationFrame(raf); updateToggle() }
    function toggle(){ if(!isRunning||isPaused){ start() } else { stop() } }
    function restart(){ if(!config.configured){ showMenu(true); return } reset(); start() }
    function openMenu(){ stop(); showMenu(true) }

    btnToggle.addEventListener('click',toggle);
    btnRestart.addEventListener('click',restart);
    btnMenu.addEventListener('click',openMenu);
    separateChk.addEventListener('change',function(){ sepBlock.classList.toggle('hidden',!separateChk.checked) });

    var chips=document.querySelectorAll('.chip[data-preset]');
    function applyPresetFrom(el){ var parts=(el.getAttribute('data-preset')||'').split(','); var a=clampHP(parts[0]), m=clampHP(parts[1]), bt=clampHP(parts[2]); hpTop1.value=a; hpMid1.value=m; hpBot1.value=bt; if(separateChk&&separateChk.checked){ hpTop2.value=a; hpMid2.value=m; hpBot2.value=bt } }
    chips.forEach(function(ch){ ch.addEventListener('click',function(e){ e.preventDefault(); applyPresetFrom(ch) })});
    if(menu){ menu.addEventListener('click',function(e){ var c=e.target.closest('.chip[data-preset]'); if(c){ e.preventDefault(); applyPresetFrom(c) } }) }

    function applyAndStart(){
      config.left.top=clampHP(hpTop1&&hpTop1.value); config.left.mid=clampHP(hpMid1&&hpMid1.value); config.left.bot=clampHP(hpBot1&&hpBot1.value);
      config.separate=!!(separateChk&&separateChk.checked);
      if(config.separate){ config.right.top=clampHP(hpTop2&&hpTop2.value); config.right.mid=clampHP(hpMid2&&hpMid2.value); config.right.bot=clampHP(hpBot2&&hpBot2.value) }
      else { config.right.top=config.left.top; config.right.mid=config.left.mid; config.right.bot=config.left.bot }
      config.left.type=(typeLeftSel&&typeLeftSel.value)||config.left.type||'strong';
      config.right.type=(typeRightSel&&typeRightSel.value)||config.right.type||'fast';
      config.configured=true; showMenu(false); reset(); start();
    }
    window.applyAndStart=applyAndStart;
    if(applyStart){ applyStart.addEventListener('click',function(e){ e.preventDefault(); e.stopPropagation(); applyAndStart() }) }
    if(menu){ menu.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); applyAndStart() } }) }
    if(typeLeftSel){ typeLeftSel.addEventListener('change',function(){ setType('left',typeLeftSel.value) }) }
    if(typeRightSel){ typeRightSel.addEventListener('change',function(){ setType('right',typeRightSel.value) }) }
    if(tabNormal){ tabNormal.addEventListener('click',function(){ currentCategory='normal'; setActiveTab(); repopulateSelects() }) }
    if(tabHybrids){ tabHybrids.addEventListener('click',function(){ currentCategory='hybrids'; setActiveTab(); repopulateSelects() }) }

    document.addEventListener('keydown',function(e){ if(e.code==='Space'){ e.preventDefault(); if(!isRunning&&winner===null){ start() } else if(winner!==null){ restart() } } });

    function bounce(b){ if(b.type==='strong'){ return 6.8 } var base=6.5, k=0.25; return base+k*Math.abs(b.vx) }
    function firstAlive(L){ if(!L||!L.blocks) return -1; for(var i=0;i<L.blocks.length;i++){ if(!L.blocks[i].broken){ return i } } return -1 }
    function surface(L){ var i=firstAlive(L); if(i>=0){ return {y:L.blocks[i].y, idx:i} } return { y:laneH-FINISH_H-BORDER, idx:-1 } }

    function intersectRayRect(x0,y0,dx,dy,rx,ry,rw,rh){
      var tmin=-Infinity, tmax=Infinity;
      if(dx!==0){ var tx1=(rx-x0)/dx, tx2=(rx+rw-x0)/dx; var ax=Math.min(tx1,tx2), bx=Math.max(tx1,tx2); tmin=Math.max(tmin,ax); tmax=Math.min(tmax,bx) }
      else if(x0<rx||x0>rx+rw){ return null }
      if(dy!==0){ var ty1=(ry-y0)/dy, ty2=(ry+rh-y0)/dy; var ay=Math.min(ty1,ty2), by=Math.max(ty1,ty2); tmin=Math.max(tmin,ay); tmax=Math.min(tmax,by) }
      else if(y0<ry||y0>ry+rh){ return null }
      if(tmax<0||tmin>tmax){ return null }
      return tmin>=0 ? tmin : tmax;
    }

    function raycastBlocks(b,L){
      var dx=Math.cos(b.laserAngle), dy=Math.sin(b.laserAngle);
      var bestT=Infinity, bestIdx=-1;
      for(var i=0;i<L.blocks.length;i++){
        var blk=L.blocks[i]; if(blk.broken) continue;
        var t=intersectRayRect(b.x,b.y,dx,dy,blk.x,blk.y,blk.w,blk.h);
        if(t!==null&&t>=0&&t<bestT){ bestT=t; bestIdx=i }
      }
      var endX, endY;
      if(bestIdx>=0){ endX=b.x+dx*bestT; endY=b.y+dy*bestT }
      else {
        var tBox=intersectRayRect(b.x,b.y,dx,dy,BORDER,BORDER,laneW-2*BORDER,laneH-2*BORDER);
        if(!(tBox>0)) tBox=800; endX=b.x+dx*tBox; endY=b.y+dy*tBox;
      }
      return { x1:b.x, y1:b.y, x2:endX, y2:endY, hitIdx:bestIdx };
    }

    function updateLasers(L){
      L.laserRays.length=0;
      for(var i=0;i<L.balls.length;i++){
        var b=L.balls[i]; if(b.type!=='laser'||b.popped) continue;
        var w=Math.abs(b.laserAngVel||1), T=Math.PI*2; b.laserAngle+=w*dtSec; if(b.laserAngle>=T){ b.laserAngle-=T }
        var ray=raycastBlocks(b,L); L.laserRays.push(ray);
        var hit=(ray&&ray.hitIdx>=0)?ray.hitIdx:-1;
        if(hit>=0){
          if(b.lastLaserBlockIdx!==hit){ b.laserTimer=0; b.lastLaserBlockIdx=hit }
          b.laserTimer+=dtSec;
          while(b.laserTimer>=b.laserInterval){
            b.laserTimer-=b.laserInterval;
            var blk=L.blocks[hit];
            if(!blk.broken){ blk.hp=Math.max(0,blk.hp-(b.laserDamage||1)); if(blk.hp===0){ blk.broken=true } b.laserHits=(b.laserHits||0)+1 }
            else { break }
          }
        } else { b.lastLaserBlockIdx=-1; b.laserTimer=0 }
      }
    }

    function duplicateBall(L,idx){
      var b=L.balls[idx]; if(!b) return;
      var c=JSON.parse(JSON.stringify(b));
      var ang=Math.random()*Math.PI*2; var s=Math.max(3,Math.hypot(b.vx||0,b.vy||0));
      var off=b.r*1.25; var nx=b.x+Math.cos(ang)*off; var ny=b.y+Math.sin(ang)*off;
      c.x=Math.min(laneW-BORDER-b.r,Math.max(BORDER+b.r,nx));
      c.y=Math.min(laneH-BORDER-b.r,Math.max(BORDER+b.r,ny));
      c.vx=Math.cos(ang)*s; c.vy=Math.sin(ang)*s; c.dirX=c.vx>=0?1:-1;
      c.popProg=0; c.popping=false; c.popped=false; c.finished=false;
      if(c.type==='laser'){ c.laserTimer=0; c.lastLaserBlockIdx=-1 }
      b.dupTimer=0; c.dupTimer=0; L.balls.push(c);
    }

    function step(){
      for(var li=0; li<lanes.length; li++){
        var L=lanes[li]; if(!L) continue;
        for(var bi=0; bi<L.balls.length; bi++){
          var b=L.balls[bi]; if(!b||b.popped) continue;

          if(b.type==='sticky'&&b.sticking){
            var idx=b.stickBlockIdx; var blk=(idx>=0&&L.blocks[idx])?L.blocks[idx]:null;
            if(!blk||blk.broken){ b.sticking=false; b.vx=b.stickKeepVX||b.vx; b.vy=-bounce(b); b.stickHitsTarget=(b.stickHitsTarget||1)+1; continue }
            b.y=blk.y-b.r; b.vy=0; b.stickTimer=(b.stickTimer||0)+dtSec;
            var hits=b.stickHitsDone||0; var target=b.stickHitsTarget||1; var iv=b.stickInterval||0.05;
            while(b.stickTimer>=iv&&hits<target){ b.stickTimer-=iv; if(!blk.broken){ blk.hp=Math.max(0,blk.hp-1); if(blk.hp===0){ blk.broken=true } } hits++ }
            b.stickHitsDone=hits;
            if(blk.broken||hits>=target){ b.sticking=false; b.vx=b.stickKeepVX||b.vx; b.vy=-bounce(b); b.stickHitsTarget=(b.stickHitsTarget||1)+1 }
            continue;
          }

          if(!(b.finished||b.popping)){
            if(b.type==='fast'||b.type==='hybrid'){
              b.spd=b.spd||Math.max(2,Math.abs(b.vx)); var _a=b.spdAccel||0.008, _k=b.spdAccelK||0.0013333333; b.spd+=_a+_k*b.spd; b.vx=(b.dirX>=0?1:-1)*b.spd;
            }
            if(b.type==='gravitron'){
              var k=(b.g>=7.5?(b.gK||0):0); b.g+=(b.gIncPS||0)*dtSec + k*b.g*dtSec;
            }
            if(b.type==='growing'){ b.r+=(b.growRatePS||0)*dtSec }
            if(b.type==='duplicator'){ b.dupTimer=(b.dupTimer||0)+dtSec; if(b.dupTimer>=(b.dupEvery||5)){ duplicateBall(L,bi) } }

            var ts=TIME_SCALE; b.x+=b.vx*ts; b.y+=b.vy*ts; b.vy+=b.g*ts;

            if(b.x-b.r<=BORDER){ b.x=BORDER+b.r; b.vx=Math.abs(b.vx); if(b.type==='fast'||b.type==='hybrid'){ b.dirX=1 } }
            if(b.x+b.r>=laneW-BORDER){ b.x=laneW-BORDER-b.r; b.vx=-Math.abs(b.vx); if(b.type==='fast'||b.type==='hybrid'){ b.dirX=-1 } }
            if(b.y-b.r<=BORDER){ b.y=BORDER+b.r; if(b.vy<0){ b.vy*=-1 } if(b.type==='gravitron'){ b.g+=(b.gBounceInc||0.02) } }

            var s=surface(L);
            if(b.y+b.r>=s.y&&b.vy>0){
              b.y=s.y-b.r;
              if(s.idx>=0){
                if(b.type==='sticky'){ b.sticking=true; b.stickBlockIdx=s.idx; b.stickHitsDone=0; b.stickTimer=0; b.stickKeepVX=b.vx; b.vx=0; b.vy=0; continue }
                var blk2=L.blocks[s.idx];
                if(!blk2.broken){
                  var dmg=(b.type==='strong'||b.type==='hybrid')?(b.damage||1):1; blk2.hp=Math.max(0,blk2.hp-dmg);
                  if(b.type==='strong'||b.type==='hybrid'){ b.damage=(b.damage||1)+1 }
                  if(b.type==='fast'||b.type==='hybrid'){ b.vy=-Math.max(bounce(b),(b.spd||Math.abs(b.vx))) } else { b.vy=-bounce(b) }
                  if(b.type==='gravitron'){ b.g+=(b.gBounceInc||0.02) }
                  if(b.type==='laser'){
                    var thr=0.01; var liInt=b.laserInterval||0.25;
                    if(liInt>thr){ liInt=Math.max(thr,liInt-0.005) }
                    else { b.laserTierHits=(b.laserTierHits||0)+1; if(b.laserTierHits>=3){ liInt=+(liInt*0.75).toFixed(5); b.laserTierHits=0 } }
                    b.laserInterval=liInt;
                  }
                  if(blk2.hp===0){ blk2.broken=true }
                }
              } else {
                b.finished=true; b.vx=0; b.vy=0; b.timeToFinish=performance.now()-startTime;
                if(winner===null){
                  winner=li; winnerEl.textContent=li===0?'Победитель: левая коробка 🏁':'Победитель: правая коробка 🏁';
                  var other=li===0?1:0; var otherLane=lanes[other];
                  if(otherLane){ for(var oj=0;oj<otherLane.balls.length;oj++){ var ob=otherLane.balls[oj]; if(ob){ ob.popping=true; ob.vx=0; ob.vy=0; ob.g=0 } } }
                  for(var wi=0;wi<L.balls.length;wi++){ L.balls[wi].vx=0; L.balls[wi].vy=0 }
                }
              }
            }
          }
        }
        updateLasers(L);
      }
    }

    function refreshHUD(){
      function textForLane(L){
        if(!L||!L.balls||L.balls.length===0) return '—';
        var alive=L.balls.filter(function(x){return !x.popped});
        var b=alive[0]||L.balls[0];
        if(b.type==='fast') return 'Скорость: '+Math.abs(b.vx).toFixed(2);
        if(b.type==='hybrid') return 'Урон: '+(b.damage||1)+' | Скорость: '+Math.abs(b.vx).toFixed(2);
        if(b.type==='growing') return 'Радиус: '+b.r.toFixed(1);
        if(b.type==='laser') return 'Лазер: '+(b.laserDamage||1).toFixed(2)+' | t '+(b.laserInterval||0).toFixed(3);
        if(b.type==='gravitron') return 'Гравитация: '+(b.g||0).toFixed(2);
        if(b.type==='duplicator') return 'Клонов: '+alive.length;
        if(b.type==='sticky') return 'Прилип: '+(b.stickHitsTarget||1);
        return 'Урон: '+(b.damage||1);
      }
      if(hudLeft) hudLeft.textContent=textForLane(lanes[0]);
      if(hudRight) hudRight.textContent=textForLane(lanes[1]);
    }

    function loop(){
      if(isPaused) return;
      var now=performance.now(); dtSec=lastTime?Math.max(0,(now-lastTime)/1000):0; lastTime=now;
      step(); drawAll(); refreshHUD();
      if(winner===null){ raf=requestAnimationFrame(loop) }
      else {
        var anyPopping=false;
        for(var li=0;li<lanes.length;li++){
          var L=lanes[li]; if(!L) continue;
          for(var bi=0;bi<L.balls.length;bi++){
            var b=L.balls[bi]; if(b&&b.popping&&!b.popped){ anyPopping=true; b.popProg+=0.06; if(b.popProg>=1){ b.popProg=1; b.popped=true; b.popping=false } }
          }
        }
        if(anyPopping){ raf=requestAnimationFrame(loop) } else { isRunning=false; updateToggle() }
      }
    }

    function drawLane(L){
      if(!L||!L.blocks) return;
      var ctx=L.ctx; ctx.clearRect(0,0,laneW,laneH);
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,laneW,START_PAD);
      var primaryBall=(L.balls&&L.balls[0])||null; var tint=tintColor(primaryBall);
      for(var i=0;i<L.blocks.length;i++){
        var bl=L.blocks[i]; if(bl.broken) continue;
        var base={r:255,g:255,b:255}; var ratio=bl.max>0?(1-(bl.hp/bl.max)):1; var t=Math.max(0,Math.min(1,ratio)); var col=mixRGB(base,tint,t);
        ctx.fillStyle=rgbToCss(col); ctx.strokeStyle='#000'; ctx.lineWidth=3;
        ctx.fillRect(bl.x,bl.y,bl.w,bl.h); ctx.strokeRect(bl.x,bl.y,bl.w,bl.h);
        ctx.fillStyle='#000'; ctx.font='900 44px Impact, Inter, system-ui, Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(String(bl.hp), bl.x+bl.w/2, bl.y+bl.h/2);
      }
      drawFinish(ctx);
      if(L.laserRays){
        for(var r=0;r<L.laserRays.length;r++){
          var ray=L.laserRays[r]; if(!ray) continue;
          ctx.beginPath(); ctx.moveTo(ray.x1,ray.y1); ctx.lineTo(ray.x2,ray.y2); ctx.lineWidth=3; ctx.strokeStyle='#1abc9c'; ctx.stroke();
          if(ray.hitIdx>=0){ ctx.beginPath(); ctx.arc(ray.x2,ray.y2,4,0,Math.PI*2); ctx.fillStyle='#1abc9c'; ctx.fill() }
        }
      }
      for(var bi=0;bi<L.balls.length;bi++){
        var ball=L.balls[bi]; if(!ball||ball.popped) continue;
        if(ball.popping){ drawPop(ctx,ball) } else { drawBall(ctx,ball) }
      }
    }

    function drawBall(ctx,ball){
      if(ball.type==='hybrid'){
        var r=ball.r;
        ctx.beginPath(); ctx.moveTo(ball.x,ball.y); ctx.arc(ball.x,ball.y,r,Math.PI/2,Math.PI*1.5); ctx.closePath(); ctx.fillStyle='#8b5a2b'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(ball.x,ball.y); ctx.arc(ball.x,ball.y,r,-Math.PI/2,Math.PI/2); ctx.closePath(); ctx.fillStyle='#cf2e2e'; ctx.fill();
        ctx.beginPath(); ctx.arc(ball.x,ball.y,r,0,Math.PI*2); ctx.lineWidth=2; ctx.strokeStyle='#000'; ctx.stroke();
        return;
      }
      ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fillStyle=ball.color; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#000'; ctx.stroke();
    }

    function drawPop(ctx,ball){
      var t=Math.min(1,ball.popProg||0);
      ctx.beginPath(); ctx.arc(ball.x,ball.y,Math.max(0,ball.r*(1-0.9*t)),0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,'+(0.08+0.12*(1-t))+')'; ctx.fill();
      for(var i=0;i<3;i++){
        var p=t+i*0.15; if(p>1) continue; var rr=ball.r*(1+p*2.6);
        ctx.beginPath(); ctx.arc(ball.x,ball.y,rr,0,Math.PI*2); ctx.lineWidth=Math.max(1,4-p*3); ctx.strokeStyle='rgba(0,0,0,'+(1-p)+')'; ctx.stroke();
      }
    }

    function drawFinish(ctx){
      var y=laneH-FINISH_H-BORDER, h=FINISH_H; ctx.fillStyle='#fff'; ctx.fillRect(0,y,laneW,h);
      var size=16; for(var row=0; row<Math.ceil(h/size); row++){ for(var col=0; col<Math.ceil(laneW/size); col++){ var black=(row+col)%2===0; ctx.fillStyle=black?'#000':'#fff'; ctx.fillRect(col*size,y+row*size,size,size) } }
      ctx.fillStyle='#000'; ctx.fillRect(0,y+h,laneW,BORDER);
    }

    function drawAll(){ for(var i=0;i<lanes.length;i++){ if(lanes[i]) drawLane(lanes[i]) } }

    lanes=[ makeLane(ctxLeft,[100,250,500],config.left.type), makeLane(ctxRight,[100,250,500],config.right.type) ];
    drawAll(); refreshHUD(); showMenu(true);