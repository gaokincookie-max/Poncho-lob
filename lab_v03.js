(()=>{'use strict';
const DATA=window.POCHO_DATA||{behaviorRules:[]}; const M=window.Matter;if(!M){alert('Matter.jsの読み込みに失敗しました');return}
const {Engine,Bodies,Body,Composite,Constraint,Events}=M;
const COLORS=[{id:'さくら',hex:'#f3a6b8'},{id:'みずいろ',hex:'#9fcfe5'},{id:'たまご',hex:'#f0d98f'},{id:'わかば',hex:'#a9d6ae'},{id:'ふじ',hex:'#b9a8da'},{id:'あんず',hex:'#eab18d'}],EXPRESSIONS=['ごきげん','ふつう','不機嫌'],DECOS=['なし','リボン','メガネ','王冠','芽'],DECO_RATE=[.85,.04,.04,.03,.04];
const T={LOW:3.5,VERY_LOW:1.8,HIGH:8,VERY_HIGH:12,STILL:1,LONG:18,SHORT:2.8,RECENT:1.2,NEAR:110,POP_PROTECT:.4};
const PHYS={UP_FORCE:.00175,MAX_SPEED:16.5,MAX_ANG:.28}; const W=390,H=650,launchY=H*.80,DT=1000/60;
const LAYERS=['special','decoration','expression','color','size']; const LABEL={special:'特殊',decoration:'装飾',expression:'表情',color:'色',size:'大きさ'};
let rng=Math.random,stopFlag=false,lastLogs=[],lastStats=null;
const $=s=>document.querySelector(s); function rand(a,b){return a+rng()*(b-a)} function choiceWeighted(items,w){let r=rng()*w.reduce((a,b)=>a+b,0);for(let i=0;i<items.length;i++){r-=w[i];if(r<=0)return items[i]}return items.at(-1)}
function seedRandom(seed){let x=(Number(seed)||1)>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function makeDescriptor(){const z=rng(),sizeClass=z<.31?'小':z<.75?'中':'大',ranges={小:[16,21],中:[21.5,27],大:[27.5,34]},rr=ranges[sizeClass],color=COLORS[(rng()*6)|0];return{color:color.id,hex:color.hex,expression:EXPRESSIONS[(rng()*3)|0],decoration:choiceWeighted(DECOS,DECO_RATE),sizeClass,radius:rand(rr[0],rr[1])}}
function emptyStats(){const bins={};return{games:0,shots:0,contacts:0,outcomes:{NONE:0,STICK:0,POP:0},layer:{},ruleActual:{},ruleShadow:{},speed:{'0-3':mk(),'3-6':mk(),'6-9':mk(),'9-12':mk(),'12+':mk()},density:{'1-5':mk(),'6-10':mk(),'11-20':mk(),'21-30':mk(),'31+':mk()},phase:{'序盤':mk(),'中盤':mk(),'終盤':mk()},groupTransitions:{},popVictims:0,popEvents:0,maxBodies:0,bodySamples:0,bodySum:0,maxGroup:1,groupSum:0,groupSamples:0,largeGroupSamples:0,logs:[]};function mk(){return{contacts:0,NONE:0,STICK:0,POP:0}}}
function bucketSpeed(v){return v<3?'0-3':v<6?'3-6':v<9?'6-9':v<12?'9-12':'12+'}function bucketDensity(n){return n<=5?'1-5':n<=10?'6-10':n<=20?'11-20':n<=30?'21-30':'31+'}function bucketPhase(i,n){return i<=n/3?'序盤':i<=n*2/3?'中盤':'終盤'}
function createWorld(stats,shots,ai,opts={}){let simNow=0,serial=1,engine=Engine.create({positionIterations:8,velocityIterations:6,constraintIterations:4,enableSleeping:false}),bodies=new Set(),bonds=new Set(),recentEvents=[];engine.gravity.x=0;engine.gravity.y=0;const side={isStatic:true,restitution:.66,friction:.01},floor={isStatic:true,restitution:.3,friction:.02},topOpt={isStatic:true,restitution:0,friction:.02};const topWall=Bodies.rectangle(W/2,-30,W+120,60,topOpt);Composite.add(engine.world,[Bodies.rectangle(-30,H/2,60,H+120,side),Bodies.rectangle(W+30,H/2,60,H+120,side),topWall,Bodies.rectangle(W/2,H+30,W+120,60,floor)]);
 function now(){return simNow} function speed(b){return Math.hypot(b.velocity.x,b.velocity.y)} function trimSeq(a,n){if(a.length>n)a.splice(0,a.length-n)} function contactRec(a,b){let r=a.pocho.contacts.get(b.pocho.id);if(!r){r={count:0,lastAt:0,firstAt:0,everStuck:false,stickCount:0,detachCount:0,lastStickAt:0,lastStickExpression:null,maxSpeed:0};a.pocho.contacts.set(b.pocho.id,r)}return r}
 function makeBody(desc){const b=Bodies.circle(W*.5,launchY,desc.radius,{restitution:.72,friction:.014,frictionAir:.0045,density:.00155,slop:.03});b.pocho={id:'p'+serial++,...desc,_initialExpression:desc.expression,launched:true,launchedAt:simNow,launchIndex:serial-1,bornAt:simNow,lastUpdate:simNow,distance:0,maxSpeed:0,highSpeedSeen:false,wall:{left:0,right:0,top:0,bottom:0,last:null,lastAt:0,sequence:[]},contacts:new Map(),contactColors:[],colorsSeen:new Set(),expressionsSeen:new Set([desc.expression]),sizesSeen:new Set(),decorationsSeen:new Set(),contactCount:0,sameColorContacts:0,diffColorContacts:0,stickCount:0,detachCount:0,everStuck:false,expressionChanges:0,lastExpressionChange:0,lastContactAt:0,lastContactId:null,lastEvent:'spawn',lastEventAt:simNow,aloneSince:simNow,longStill:false,stillSince:0,groupsHistory:[],maxGroup:1,popWitnessed:0,lastPushedBy:null,lastPushAt:0,behaviorCandidateHits:0};return b}
 function getGroup(start){if(!start?.pocho)return[];const out=[],seen=new Set([start]),stack=[start];while(stack.length){const b=stack.pop();out.push(b);for(const c of bonds){let n=null;if(c.bodyA===b)n=c.bodyB;else if(c.bodyB===b)n=c.bodyA;if(n?.pocho&&!seen.has(n)){seen.add(n);stack.push(n)}}}return out}
 function isBonded(a,b){for(const c of bonds)if((c.bodyA===a&&c.bodyB===b)||(c.bodyA===b&&c.bodyB===a))return true;return false}
 function getNearby(x,y,r,exclude=[]){const ex=new Set(exclude);return[...bodies].filter(b=>b.pocho&&!ex.has(b)&&Math.hypot(b.position.x-x,b.position.y-y)<=r)}
 function wallHit(p,side){if(simNow-p.wall.lastAt<180&&p.wall.last===side)return;p.wall[side]++;p.wall.last=side;p.wall.lastAt=simNow;p.wall.sequence.push(side);trimSeq(p.wall.sequence,8)}
 function wallChecks(){for(const b of bodies){const p=b.pocho,r=p.radius;if(b.position.x<r+4)wallHit(p,'left');if(b.position.x>W-r-4)wallHit(p,'right');if(b.position.y>H-r-4)wallHit(p,'bottom')}}
 function pushRecent(e){recentEvents.push(e);while(recentEvents.length&&recentEvents[0].time<simNow-15000)recentEvents.shift()}
 function wallTotal(p){return p.wall.left+p.wall.right+p.wall.top+p.wall.bottom} function maxContactPartner(p){let id=null,n=-1;for(const[k,v]of p.contacts)if(v.count>n){n=v.count;id=k}return id}
 function collisionContext(a,b,pair){const av=speed(a),bv=speed(b),rv=Math.hypot(a.velocity.x-b.velocity.x,a.velocity.y-b.velocity.y),dx=b.position.x-a.position.x,dy=b.position.y-a.position.y,dist=Math.max(1,Math.hypot(dx,dy)),relDot=((a.velocity.x-b.velocity.x)*dx+(a.velocity.y-b.velocity.y)*dy)/(Math.max(.01,rv)*dist);return{id:serial++,time:simNow,a,b,primary:a,other:b,x:(a.position.x+b.position.x)/2,y:(a.position.y+b.position.y)/2,av,bv,relativeSpeed:rv,headOn:Math.abs(relDot)>.62,shallow:Math.abs(relDot)<.34,near:getNearby((a.position.x+b.position.x)/2,(a.position.y+b.position.y)/2,T.NEAR,[a,b]),groupA:getGroup(a),groupB:getGroup(b),preColorsA:new Set(a.pocho.colorsSeen),preColorsB:new Set(b.pocho.colorsSeen),prevContactIdA:a.pocho.lastContactId,prevContactIdB:b.pocho.lastContactId,prevPushedByA:a.pocho.lastPushedBy,prevPushedByB:b.pocho.lastPushedBy,pair}}
 function ruleAppliesAttribute(r,self){const a=r.attribute,p=self.pocho;if(r.layer==='size')return a===p.sizeClass;if(r.layer==='color')return a===p.color;if(r.layer==='expression')return a===p.expression;if(r.layer==='decoration')return a===p.decoration;if(r.layer==='special')return a.split('×').every(x=>x===p.color||x===p.expression||x===p.decoration||x===p.sizeClass);return false}
 function checkCondition(text,ctx,self,other){return String(text).split('＋').map(s=>s.trim()).every(c=>checkClause(c,ctx,self,other))}
function checkClause(c,ctx,self=ctx.primary||ctx.a,other=ctx.other||(self===ctx.a?ctx.b:ctx.a)){
 const p=self?.pocho,q=other?.pocho,now=ctx.time||performance.now();if(!p)return false;
 const rec=q?contactRec(self,other):null, age=(now-p.bornAt)/1000, sv=speed(self), ov=other?speed(other):0, rv=ctx.relativeSpeed??(other?Math.hypot(self.velocity.x-other.velocity.x,self.velocity.y-other.velocity.y):0);
 if(c.startsWith('弾け補正：相対速度')){const m=c.match(/([0-9]+(?:\.[0-9]+)?)以上/);return !!m&&rv>=Number(m[1]);}
 const g=getGroup(self), og=other?getGroup(other):[], all=ctx.victims?.length?ctx.victims:g, near=ctx.near||getNearby(ctx.x??self.position.x,ctx.y??self.position.y,T.NEAR,[self]);
 const colors=new Set(all.filter(x=>x.pocho).map(x=>x.pocho.color)), exprs=new Set(all.filter(x=>x.pocho).map(x=>x.pocho.expression)), sizes=new Set(all.filter(x=>x.pocho).map(x=>x.pocho.sizeClass)), decos=all.filter(x=>x.pocho&&x.pocho.decoration!=='なし').map(x=>x.pocho.decoration);
 // role/compound shorthands that need exact semantics
 if(c==='両方ごきげん')return q&&p.expression==='ごきげん'&&q.expression==='ごきげん';
 if(c==='両方不機嫌'||c==='不機嫌同士')return q&&p.expression==='不機嫌'&&q.expression==='不機嫌';
 if(c==='両方大'||c==='両方大サイズ'||c==='大サイズ同士')return q&&p.sizeClass==='大'&&q.sizeClass==='大';
 if(c==='両方装飾あり'||c==='両方装飾付き')return q&&p.decoration!=='なし'&&q.decoration!=='なし';
 if(c==='同装飾')return q&&p.decoration!=='なし'&&p.decoration===q.decoration;
 if(c==='同色ではない')return q&&p.color!==q.color;
 if(c==='同表情ではない')return q&&p.expression!==q.expression;
 if(c==='双方長時間生存'||c==='長時間同じ盤面に存在')return q&&age>=T.LONG&&((now-q.bornAt)/1000)>=T.LONG;
 if(c==='互いに一度も接触したことがない')return rec&&rec.count<=1;
 if(c==='全員高速ではない')return all.length>0&&all.every(x=>speed(x)<T.HIGH);
 if(c==='低速ぽちょが過半数'){const pool=near.length?near:all;return pool.length>0&&pool.filter(x=>speed(x)<=T.LOW).length>pool.length/2;}
 if(c==='壁3種類以上へ接触')return ['left','right','top','bottom'].filter(k=>p.wall[k]>0).length>=3;
 if(c==='左右壁接触済み')return p.wall.left>0&&p.wall.right>0;
 if(c==='起爆ぽちょが単独ではない')return (ctx.victims?.length||1)>1;
 if(c==='起爆ぽちょと誘爆ぽちょが異色')return (ctx.victims||[]).some(x=>x!==ctx.primary&&x.pocho.color!==ctx.primary?.pocho.color);
 if(c==='最後は誘爆ではなく自分が起爆')return ctx.trigger==='弾ける'&&self===ctx.primary;
 if(c==='装飾ありが含まれる')return decos.length>=1;
 if(c==='ごきげん・ふつう・不機嫌を全経験'||c==='3表情すべて経験済み')return p.expressionsSeen.size>=3;
 if(c==='3表情全て'||c==='3表情すべて含む')return exprs.size===3;
 if(c==='3サイズすべて含む')return sizes.size===3;
 if(c==='3体のうち2色以上')return (ctx.groupAfter?.length||0)>=3&&new Set(ctx.groupAfter.map(x=>x.pocho.color)).size>=2;
 if(c==='4体すべて異なる色')return (ctx.causeChain?.length||0)>=4&&new Set(ctx.causeChain.slice(-4).map(x=>x.pocho.color)).size===4;
 if(c==='AとDは直接接触していない')return (ctx.causeChain?.length||0)>=4&&!(ctx.causeChain[0].pocho.contacts.has(ctx.causeChain.at(-1).pocho.id));
 if(c==='他グループ2つ以上が至近距離'){const groups=[];const seen=new Set();for(const n of near){if(seen.has(n))continue;const gg=getGroup(n);gg.forEach(x=>seen.add(x));groups.push(gg)}return groups.length>=2;}
 if(c==='爆発によって密集が解消')return !!ctx.densityWillResolve;
 if(c==='加入者が単独だった')return !!ctx.newlyJoined&&((ctx.preGroupSize?.get(ctx.newlyJoined.pocho.id)||1)===1);
 if(c==='加入者が異色')return !!ctx.newlyJoined&&ctx.groupBefore?.some(x=>x.pocho.color!==ctx.newlyJoined.pocho.color);
 if(c==='初めて接着')return (ctx.prePairStickCount||0)===0;
 if(c==='3回目の再接着')return (ctx.prePairStickCount||0)===2;
 if(c==='同じ相手と過去2回接着')return (rec?.stickCount||0)>=2;
 if(c==='2回とも一度離れている')return (rec?.detachCount||0)>=2;
 if(c==='4体以上のグループ成立'||c==='一度の連続接着で4体グループ成立')return (ctx.groupAfter?.length||0)>=4;
 if(c==='誰も過去に接着経験なし')return ctx.preEverStuck&&[...ctx.preEverStuck.values()].every(v=>!v);
 if(c==='両方ともその後別グループ所属経験あり')return q&&p.maxGroup>=2&&q.maxGroup>=2&&p.detachCount>0&&q.detachCount>0;
 if(c==='離れている間に双方が別ぽちょへ接触')return q&&(rec?.detachCount||0)>0&&p.contacts.size>=2&&q.contacts.size>=2;
 if(c==='再会')return rec&&rec.count>=2;
 if(c==='一度離れて一定時間経過'||c==='一定時間以上離れていた')return (rec?.detachCount||0)>0&&now-(rec?.lastStickAt||0)>=3000;
 if(c==='接触時間が短い')return false; // collisionEnd計測未実装。該当役はinactive
 if(c==='自分もごきげん')return p.expression==='ごきげん';
 if(c==='互いに過去3回以上接触')return rec&&rec.count>=3;
 if(c==='他ぽちょへ接触'||c==='他ぽちょへ衝突')return !!q;
 if(c==='一度くっついて離れた履歴あり'||c==='一度くっついて離れた')return p.everStuck&&p.detachCount>0;
 if(c==='別グループに接触'||c==='別グループへ衝突'||c==='新しいグループへ接触')return q&&og.length>=2&&!g.includes(q);
 if(c==='初回衝突')return p.contactCount<=1;
 if(c==='直前に周囲で別のぽちょが弾けた')return recentEvents.some(e=>e.type==='弾ける'&&now-e.time<2000);
 if(c==='小さいあんず')return p.color==='あんず'&&p.sizeClass==='小';
 if(c==='接触地点の近くに他ぽちょが少ない')return near.length<=2;
 if(c==='過去に接触したことのない色'){const pre=self===ctx.a?ctx.preColorsA:ctx.preColorsB;return q&&!pre.has(q.color);}
 if(c==='自分の速度も低い')return sv<=T.LOW;
 if(c==='自分も移動中')return sv>T.STILL;
 if(c==='総接触回数が偶数')return p.contactCount>0&&p.contactCount%2===0;
 if(c==='自分が周辺最大サイズ'||c==='自分が周辺で最大サイズ')return near.every(x=>x.pocho.radius<=p.radius+.1);
 if(c==='外部ぽちょに衝突')return q&&!g.includes(other);
 if(c==='生存中に3色以上へ接触済み')return p.colorsSeen.size>=3;
 if(c==='今回が同色')return q&&p.color===q.color;
 if(c==='壁に2回以上当たっている')return wallTotal(p)>=2;
 if(c==='自分からぶつかる')return sv>ov+0.5;
 if(c==='接触地点付近に他ぽちょが2体以上')return near.length>=2;
 if(c==='1回の接触を起点')return !!q;
 if(c==='一度も接着なし')return !p.everStuck;
 if(c==='誘爆数3体以上')return Math.max(0,(ctx.victims?.length||1)-1)>=3;
 if(c==='4体全員が互いに未接触だった組み合わせを含む'){const gg=ctx.groupAfter||[];if(gg.length<4)return false;for(let i=0;i<gg.length;i++)for(let j=i+1;j<gg.length;j++){const rr=gg[i].pocho.contacts.get(gg[j].pocho.id);if(!rr||rr.count===0)return true;}return false;}
 if(c==='過去に複数回接触')return rec&&rec.count>=3;
 if(c==='離脱')return p.detachCount>0;
 if(c==='接着3回以上')return p.stickCount>=3;
 if(c==='装飾あり'){if(ctx.victims?.length)return ctx.victims.some(x=>x.pocho.decoration!=='なし');return p.decoration!=='なし';}
 // literal self attributes
 if(COLORS.some(x=>x.id===c))return p.color===c;if(EXPRESSIONS.includes(c))return p.expression===c;if(DECOS.includes(c))return p.decoration===c;if(['小','中','大'].includes(c))return p.sizeClass===c;
 if(c==='リボン付き')return p.decoration==='リボン';if(c==='メガネ付き')return p.decoration==='メガネ';if(c==='王冠付き')return p.decoration==='王冠';if(c==='芽付き')return p.decoration==='芽';
 if(c==='自分がごきげん')return p.expression==='ごきげん';if(c==='自分がふつう')return p.expression==='ふつう';if(c==='自分が不機嫌')return p.expression==='不機嫌';
 if(c==='自分が小'||c==='自分が小サイズ')return p.sizeClass==='小';if(c==='自分が大')return p.sizeClass==='大';
 // pair attributes
 if(c==='同色'||c==='相手が同色'||c==='同色相手'||c==='今回が同色接触')return q&&p.color===q.color;if(c==='異色'||c==='相手が異色'||c==='異色相手'||c==='異色接触'||c==='衝突相手が異色')return q&&p.color!==q.color;
 if(c==='異色相手へ高速接触'||c==='異色相手 ＋ 高速接触')return q&&p.color!==q.color&&rv>=T.HIGH;if(c==='低速で別相手に接触')return q&&rv<=T.LOW&&(p.lastContactId!==q.id||rec?.count<=1);if(c==='異色相手に接触')return q&&p.color!==q.color;
 if(c==='相手がさくら')return q?.color==='さくら';if(c==='相手もたまご')return q?.color==='たまご';
 if(c==='相手がごきげん'||c==='相手もごきげん')return q?.expression==='ごきげん';if(c==='相手がふつう'||c==='相手がふつう表情')return q?.expression==='ふつう';if(c==='相手が不機嫌'||c==='相手も不機嫌')return q?.expression==='不機嫌';
 if(c.includes('同じ表情')||c==='同表情'||c==='双方同表情')return q&&p.expression===q.expression;if(c.includes('異表情')||c.includes('表情が異なる'))return q&&p.expression!==q.expression;
 if(c==='ごきげんと不機嫌')return q&&new Set([p.expression,q.expression]).has('ごきげん')&&new Set([p.expression,q.expression]).has('不機嫌');
 if(c.includes('相手が大')||c==='相手も大'||c==='相手も大サイズ')return q?.sizeClass==='大';if(c.includes('相手が中以上'))return q&&q.sizeClass!=='小';if(c==='相手が中')return q?.sizeClass==='中';if(c==='相手が小')return q?.sizeClass==='小';if(c==='相手も小')return q?.sizeClass==='小';if(c==='相手も中')return q?.sizeClass==='中';
 if(c.includes('サイズ区分も同じ')||c==='同サイズ区分'||c==='サイズ区分同じ')return q&&p.sizeClass===q.sizeClass;
 if(c.includes('サイズが小と大'))return q&&new Set([p.sizeClass,q.sizeClass]).has('小')&&new Set([p.sizeClass,q.sizeClass]).has('大');
 const rd=q?Math.abs(p.radius-q.radius):0, ratio=q?Math.max(p.radius,q.radius)/Math.min(p.radius,q.radius):1;
 if(c.includes('サイズ差が非常に小')||c.includes('実サイズ差が非常に小'))return rd<=2.4;if(c.includes('サイズ差が小')||c.includes('サイズ差が一定以下')||c.includes('サイズが自分と近い'))return rd<=5;if(c.includes('サイズ差が大き')||c.includes('サイズ差がかなり大き'))return ratio>=1.38;
 if(c.includes('自分より大きい'))return q&&q.radius>p.radius+2;if(c.includes('自分より小さい')||c==='相手より小さい')return q&&q.radius<p.radius-2;if(c.includes('接触相手より自分が大きい'))return q&&p.radius>q.radius+2;if(c==='古い方が大きい')return q&&((p.launchIndex<q.launchIndex&&p.radius>q.radius)||(q.launchIndex<p.launchIndex&&q.radius>p.radius));
 if(c.includes('低速')||c.includes('速度が低い')||c.includes('高速ではない')){if(c.includes('相対'))return rv<=T.LOW;if(c.includes('両方')||c.includes('双方')||c.includes('どちらも')||c.includes('現在どちらも'))return sv<=T.LOW&&ov<=T.LOW;return sv<=T.LOW||rv<=T.LOW}
 if(c.includes('かなり低速'))return rv<=T.VERY_LOW;
 if(c.includes('高速')||c.includes('速度が高い')||c.includes('速度が一定以上')){if(c.includes('非常に高速'))return sv>=T.VERY_HIGH||ov>=T.VERY_HIGH;if(c.includes('両方')||c.includes('双方'))return sv>=T.HIGH&&ov>=T.HIGH;if(c.includes('相対'))return rv>=T.HIGH;return sv>=T.HIGH||rv>=T.HIGH}
 if(c.includes('接触速度が中程度'))return rv>T.LOW&&rv<T.HIGH;
 if(c.includes('正面'))return !!ctx.headOn;if(c.includes('接触角度が浅い'))return !!ctx.shallow;
 if(c.includes('停止')||c.includes('ほぼ停止')){if(c.includes('両者'))return sv<T.STILL&&ov<T.STILL;if(c.includes('相手'))return ov<T.STILL;return sv<T.STILL}
 if(c.includes('接触後の速度が急激に低下')||c.includes('接触後に両者の速度が低下'))return rv<T.HIGH;
 // position / surroundings
 if(c.includes('画面上半分')||c.includes('画面上部'))return (ctx.y??self.position.y)<H*.5;if(c.includes('天井付近'))return (ctx.y??self.position.y)<H*.22;if(c.includes('壁際'))return (ctx.x??self.position.x)<55||(ctx.x??self.position.x)>W-55;if(c.includes('壁際ではない'))return (ctx.x??self.position.x)>=55&&(ctx.x??self.position.x)<=W-55;
 if(c.includes('画面中央付近'))return Math.abs((ctx.x??self.position.x)-W/2)<W*.18&&Math.abs((ctx.y??self.position.y)-H/2)<H*.22;if(c.includes('画面の角付近'))return (((ctx.x??0)<70||(ctx.x??0)>W-70)&&((ctx.y??0)<90||(ctx.y??0)>H-90));
 let m;if((m=c.match(/近くに(?:他ぽちょが)?(\d+)体以上/))||(m=c.match(/周囲に(?:他ぽちょが)?(\d+)体以上/))||(m=c.match(/接触地点周辺に(\d+)体以上/))||(m=c.match(/接触地点の近くにぽちょが(\d+)体以上/))||(m=c.match(/接触地点周囲に(\d+)体以上/)))return near.length>=+m[1];
 if(c.includes('周囲に他ぽちょが少ない')||c.includes('周囲が密集していない'))return near.length<=2;if(c.includes('接触地点近くに他ぽちょが2体以下'))return near.length<=2;if(c.includes('接触地点周辺に複数のぽちょ'))return near.length>=2;if(c.includes('接触地点が密集地帯')||c.includes('周囲に他ぽちょが多い'))return near.length>=4;
 if((m=c.match(/周囲に(\d+)色以上/))||(m=c.match(/周囲に異色が(\d+)色以上/))){const s=new Set(near.map(x=>x.pocho.color));if(c.includes('異色'))s.delete(p.color);return s.size>=+m[1]}
 if(c.includes('周囲に同色が2体以上'))return near.filter(x=>x.pocho.color===p.color).length>=2;if(c.includes('周囲に自分と同色がいない'))return !near.some(x=>x.pocho.color===p.color);
 if(c.includes('周囲に同表情が2体以上'))return near.filter(x=>x.pocho.expression===p.expression).length>=2;if(c.includes('周囲のぽちょの表情が全てバラバラ'))return near.length>=2&&new Set(near.map(x=>x.pocho.expression)).size===near.length;
 // wall / motion history
 if(c.includes('壁に一度も触れていない')||c==='壁未接触')return wallTotal(p)===0;if(c.includes('壁接触経験あり'))return wallTotal(p)>0;if(c.includes('両方とも壁接触経験あり')||c.includes('両方壁接触済み'))return q&&wallTotal(p)>0&&wallTotal(q)>0;
 if(c.includes('天井接触済み')||c.includes('天井に一度触れている')||c.includes('天井接触経験あり'))return p.wall.top>0;if(c.includes('双方天井接触済み')||c.includes('相手も天井接触済み'))return q&&p.wall.top>0&&q.wall.top>0;
 if(c.includes('左右両壁に接触済み')||c.includes('左右両方の壁に触れた'))return p.wall.left>0&&p.wall.right>0;if(c.includes('全員左壁接触済み'))return all.length>0&&all.every(x=>x.pocho.wall.left>0);if(c.includes('全員右壁接触済み'))return all.length>0&&all.every(x=>x.pocho.wall.right>0);if(c.includes('全員天井接触済み'))return all.length>0&&all.every(x=>x.pocho.wall.top>0);
 if((m=c.match(/壁接触(?:回数)?が?(\d+)回以上/))||(m=c.match(/壁(\d+)回以上/)))return wallTotal(p)>=+m[1];if(c.includes('壁接触回数が少ない'))return wallTotal(p)<=2;if(c.includes('壁接触回数が偶数'))return wallTotal(p)>0&&wallTotal(p)%2===0;if(c.includes('壁接触回数が3の倍数'))return wallTotal(p)>0&&wallTotal(p)%3===0;
 if(c.includes('壁接触直後')||c.includes('壁反射直後')||c.includes('自分が壁接触直後'))return now-p.wall.lastAt<=T.RECENT*1000;if(c.includes('天井接触直後'))return p.wall.last==='top'&&now-p.wall.lastAt<=T.RECENT*1000;
 if(c.includes('左壁→右壁の順')){const s=p.wall.sequence;return s.length>=2&&s.at(-2)==='left'&&s.at(-1)==='right'}if(c.includes('同じ種類の壁に触れたことがある'))return q&&['left','right','top'].some(k=>p.wall[k]>0&&q.wall[k]>0);
 if(c.includes('累計移動距離が長い')||c.includes('射出後一定距離以上移動済み'))return p.distance>H*1.25;if(c.includes('高速状態を経験済み'))return p.highSpeedSeen;
 // time/history
 if(c.includes('生存時間が長い')||c.includes('長時間生存')||c.includes('生存時間が一定以上')||c.includes('生存時間一定以上'))return age>=T.LONG;if(c.includes('射出から短時間'))return age<=T.SHORT;if(c.includes('射出から一定時間経過'))return age>=8;
 if(c.includes('長時間単独'))return now-p.aloneSince>=9000;if(c.includes('長時間他ぽちょと接触していない')||c.includes('接触前に一定時間誰とも触れていない'))return now-p.lastContactAt>=6000;if(c.includes('長時間静止'))return p.longStill;
 if(c.includes('表情変化経験なし')||c.includes('表情変化なし'))return p.expressionChanges===0;if(c.includes('表情変化経験あり')||c.includes('過去に表情変化済み'))return p.expressionChanges>0;if(c.includes('表情変化2回以上'))return p.expressionChanges>=2;if(c.includes('3表情すべて経験'))return p.expressionsSeen.size>=3;
 if(c.includes('初期表情ふつう'))return p._initialExpression==='ふつう'||(p.expressionChanges===0&&p.expression==='ふつう');if(c.includes('現在表情ふつう'))return p.expression==='ふつう';
 if(c.includes('サイズが一度変化した履歴'))return false;
 // contact history
 if(c.includes('初対面')||c.includes('初接触')||c.includes('今まで接触なし')||c.includes('過去に接触なし'))return rec?rec.count<=1:true;
 if(c.includes('過去に一度以上接触済み')||c.includes('過去に接触済み')||c.includes('過去接触あり'))return rec&&rec.count>=2;
 if(c.includes('再接触'))return rec&&rec.count>=2;
 if((m=c.match(/同じ相手との(\d+)回目以上?の?接触/))||(m=c.match(/接触(\d+)回目以上/))||(m=c.match(/過去に(\d+)回以上接触/)))return rec&&rec.count>=+m[1];
 if((m=c.match(/同じ相手との(\d+)回目の接触/)))return rec&&rec.count===+m[1];
 if((m=c.match(/接触回数(\d+)回以上/))||(m=c.match(/総接触回数が(\d+)回以上/)))return p.contactCount>=+m[1];if(c.includes('接触回数2回以下'))return p.contactCount<=2;
 if((m=c.match(/同じ2体が過去(\d+)回以上接触/))||(m=c.match(/同じ相手と接触(\d+)回以上/)))return rec&&rec.count>=+m[1];if((m=c.match(/過去接触(\d+)回以上/)))return rec&&rec.count>=+m[1];
 if(c.includes('接触相手5体以上'))return p.contacts.size>=5;if(c.includes('3色以上と接触')||c.includes('過去に3種類以上の色と接触'))return p.colorsSeen.size>=3;if(c.includes('4色以上と接触'))return p.colorsSeen.size>=4;if(c.includes('全6色と接触')||c.includes('6色全てに接触')||c.includes('全基本色へ接触'))return p.colorsSeen.size>=6;
 if(c.includes('小中大すべてのサイズ区分と接触'))return p.sizesSeen.size>=3;if(c.includes('装飾4種すべてと接触'))return p.decorationsSeen.size>=4;
 if(c.includes('直近3回の接触相手がすべて異なる'))return p.contactColors.length>=3&&new Set(p.contactColors.slice(-3)).size===3;if(c.includes('直近の接触色が3種類すべて異なる'))return p.contactColors.length>=3&&new Set(p.contactColors.slice(-3)).size===3;
 if(c.includes('今回が4色目')||c.includes('4種類目へ接触'))return p.colorsSeen.size===4;if(c.includes('生存中にちょうど3種類の色と接触済み'))return p.colorsSeen.size===4; // current was just added
 if(c.includes('今まで未接触色')||c.includes('今回が未接触色'))return rec&&rec.count<=1;
 if(c.includes('同色接触回数より異色接触回数が多い'))return p.diffColorContacts>p.sameColorContacts;
 // launch order
 if(c.includes('奇数番目に射出'))return p.launchIndex%2===1;if(c.includes('相手が偶数番目'))return q&&q.launchIndex%2===0;if(c.includes('射出順が相手より後'))return q&&p.launchIndex>q.launchIndex;if(c.includes('射出順の差が偶数'))return q&&Math.abs(p.launchIndex-q.launchIndex)%2===0;if(c.includes('射出順が相手と3つ差'))return q&&Math.abs(p.launchIndex-q.launchIndex)===3;if(c.includes('5発以上前に射出'))return q&&Math.abs(p.launchIndex-q.launchIndex)>=5;
 // sticking / groups
 if(c.includes('現在単独')||c.includes('自分は単独')||c.includes('自分も単独状態')||c.includes('現在グループに属していない'))return g.length===1;if(c.includes('相手が単独'))return og.length===1;if(c.includes('双方単独')||c.includes('どちらも現在単独状態'))return g.length===1&&og.length===1;
 if(c.includes('一度もくっついていない')||c.includes('一度も接着していない')||c.includes('一度も接着経験なし')||c.includes('一度も接着したことがない'))return !p.everStuck;if(c.includes('一度くっついた')||c.includes('接着経験あり')||c.includes('過去接着経験あり'))return p.everStuck;
 if(c.includes('一度くっついた相手')||c.includes('過去に同じ相手と接着')||c.includes('同じ2体が過去に接着'))return rec?.everStuck;
 if(c.includes('一度離れ')||c.includes('離脱経験あり')||c.includes('その後離れた'))return p.detachCount>0||(rec?.detachCount>0);if(c.includes('現在は離れている'))return q&&!isBonded(self,other);
 if(c.includes('過去に同じグループだった'))return rec?.everStuck||p.groupsHistory.some(arr=>arr.includes(q?.id));
 if((m=c.match(/接着経験(\d+)回以上/)))return p.stickCount>=+m[1];if((m=c.match(/離脱(\d+)回以上/)))return p.detachCount>=+m[1];
 if(c.includes('相手が2体以上のグループ所属'))return og.length>=2;if(c.includes('相手がグループ所属'))return og.length>=2;if(c.includes('グループ人数4体以上'))return g.length>=4;if(c.includes('3体以上の接着グループになる')||c.includes('新しく3体グループが成立'))return ctx.groupAfter?.length>=3;if(c.includes('3体以上の既存グループへ加入'))return ctx.groupBefore?.length>=3;if(c.includes('既存4体以上グループへ加入'))return ctx.groupBefore?.length>=4;
 if(c.includes('接着グループ6体以上'))return all.length>=6;if(c.includes('接着グループ8体以上'))return all.length>=8;if(c.includes('起爆グループ3体以上'))return all.length>=3;if(c.includes('起爆グループ4体以上'))return all.length>=4;
 if(c.includes('グループ内に3色以上'))return colors.size>=3;if(c.includes('加入先に同色なし'))return ctx.groupBefore&&!ctx.groupBefore.some(x=>x.pocho.color===p.color);if(c.includes('加入先に同表情が1体以上'))return ctx.groupBefore?.some(x=>x.pocho.expression===p.expression);
 if(c.includes('自分がグループ内最大')||c.includes('自分がその中で最大')||c.includes('周辺で最大サイズ'))return all.every(x=>!x.pocho||x.pocho.radius<=p.radius+.1);
 if(c.includes('起爆ぽちょがグループ最古参'))return ctx.primary&&all.every(x=>x.pocho.launchIndex>=ctx.primary.pocho.launchIndex);if(c.includes('起爆ぽちょが最も壁接触回数が多い'))return ctx.primary&&all.every(x=>wallTotal(x.pocho)<=wallTotal(ctx.primary.pocho));
 // group composition roles
 if((m=c.match(/(?:グループ|誘爆内|起爆グループ|全体)で?(\d+)色以上/))||(m=c.match(/^(\d+)色以上$/)))return colors.size>=+m[1];if(c.includes('5色以上'))return colors.size>=5;if(c.includes('6色全て1体ずつ'))return all.length===6&&colors.size===6;
 if(c.includes('3表情すべて'))return exprs.size===3;if(c.includes('2表情以上'))return exprs.size>=2;if(c.includes('3表情中2種類以上'))return exprs.size>=2;if(c.includes('表情3種が2体ずつ'))return all.length===6&&EXPRESSIONS.every(e=>all.filter(x=>x.pocho.expression===e).length===2);
 if(c.includes('3サイズすべて'))return sizes.size===3;if(c.includes('サイズ区分2種類以上'))return sizes.size>=2;if(c.includes('小中大が2体ずつ'))return all.length===6&&['小','中','大'].every(s=>all.filter(x=>x.pocho.sizeClass===s).length===2);
 if(c.includes('装飾2種類以上'))return new Set(decos).size>=2;if(c.includes('装飾ありが1体以上')||c.includes('装飾ありを含む')||c.includes('装飾持ちを含む'))return decos.length>=1;if(c.includes('装飾ありが2体以上'))return decos.length>=2;if(c.includes('全員装飾なし'))return decos.length===0;if(c.includes('同じ装飾なし'))return new Set(decos).size===decos.length;
 // pop / induced
 if(c==='誘爆なし'||c==='今回誘爆なし')return (ctx.victims?.length||1)===1;if((m=c.match(/誘爆(\d+)体以上/)))return Math.max(0,(ctx.victims?.length||1)-1)>=+m[1];if(c.includes('誘爆あり'))return (ctx.victims?.length||1)>1;
 if(c.includes('誘爆込み4体以上'))return (ctx.victims?.length||0)>=4;if(c.includes('誘爆込み6体'))return (ctx.victims?.length||0)===6;if(c.includes('1回の起爆から5体以上消滅'))return (ctx.victims?.length||0)>=5;
 if(c.includes('起爆ぽちょが大サイズ'))return ctx.primary?.pocho.sizeClass==='大';if(c.includes('起爆ぽちょが小サイズ'))return ctx.primary?.pocho.sizeClass==='小';if(c.includes('起爆ぽちょがごきげん'))return ctx.primary?.pocho.expression==='ごきげん';if(c.includes('起爆ぽちょが天井接触済み'))return ctx.primary?.pocho.wall.top>0;if(c.includes('起爆ぽちょが装飾なし'))return ctx.primary?.pocho.decoration==='なし';if(c.includes('起爆ぽちょが不機嫌ではない'))return ctx.primary?.pocho.expression!=='不機嫌';
 if(c.includes('高速衝突が原因'))return ctx.relativeSpeed>=T.HIGH;if(c.includes('起爆原因が第三者から押された衝突')){const prev=ctx.primary===ctx.a?ctx.prevPushedByA:ctx.prevPushedByB;return !!prev&&prev!==other?.pocho.id;}
 if(c.includes('誘爆ぽちょに2色以上'))return new Set((ctx.victims||[]).filter(x=>x!==ctx.primary).map(x=>x.pocho.color)).size>=2;if(c.includes('起爆ぽちょと異表情が含まれる'))return (ctx.victims||[]).some(x=>x!==ctx.primary&&x.pocho.expression!==ctx.primary.pocho.expression);if(c.includes('起爆ぽちょと同色が誘爆にいない'))return !(ctx.victims||[]).some(x=>x!==ctx.primary&&x.pocho.color===ctx.primary.pocho.color);
 if(c.includes('誘爆内に3色以上'))return new Set((ctx.victims||[]).filter(x=>x!==ctx.primary).map(x=>x.pocho.color)).size>=3;
 if(c.includes('誘爆経験を目撃済み'))return p.popWitnessed>0;
 // event history / causality
 if(c.includes('直前3秒以内に別の接着イベント')||c.includes('その直前3秒以内に別の接着イベント'))return recentEvents.some(e=>e.type==='くっつく'&&now-e.time<3000);if(c.includes('さらに別の無反応イベント'))return recentEvents.some(e=>e.type==='何も起こらない'&&now-e.time<3000);if(c.includes('直近10秒以内に1000点以上獲得済み'))return recentEvents.filter(e=>e.type==='score'&&now-e.time<10000).reduce((s,e)=>s+(e.score||0),0)>=1000;
 if(c.includes('AがBを押す')||c.includes('BがCに衝突')||c.includes('CがDに接触')||c.includes('Dが起爆')||c.includes('因果経路5体以上')||c.includes('起点ぽちょと起爆ぽちょが別'))return (ctx.causeChain?.length||2)>= (c.includes('5体')?5:2);
 if(c.includes('起点と起爆は直接接触なし'))return (ctx.causeChain?.length||0)>=3;if(c.includes('途中で壁反射を1回以上挟む'))return (ctx.causeChain||[]).some(x=>x.pocho&&wallTotal(x.pocho)>0);if(c.includes('経路中4色以上'))return new Set((ctx.causeChain||[]).map(x=>x.pocho?.color)).size>=4;if(c.includes('経路中2表情以上'))return new Set((ctx.causeChain||[]).map(x=>x.pocho?.expression)).size>=2;if(c.includes('起点ぽちょはまだ生存'))return true;
 // deliberately difficult / metadata-ish clauses
 if(c.includes('互いに最も接触回数の多い相手'))return q&&maxContactPartner(p)===q.id&&maxContactPartner(q)===p.id;
 if(c.includes('一度もどちらも弾けていない'))return true;if(c.includes('どちらも弾けない')||c.includes('何も発生しない')||c.includes('それでも何も起こらない')||c.includes('それでも無反応')||c.includes('何も起きない')||c.includes('どの挙動条件にも該当しない'))return ctx.trigger==='何も起こらない';
 if(c.includes('一度も弾け条件未成立'))return p.behaviorCandidateHits===0;if(c.includes('起爆条件候補を過去に複数回満たした履歴'))return p.behaviorCandidateHits>=2;
 if(c.includes('前回')&&c.includes('表情'))return rec?.lastStickExpression?rec.lastStickExpression!==p.expression:false;
 if(c.includes('同じ装飾'))return q&&p.decoration!=='なし'&&p.decoration===q.decoration;if(c.includes('装飾種類が異なる'))return q&&p.decoration!=='なし'&&q.decoration!=='なし'&&p.decoration!==q.decoration;if(c.includes('相手も装飾あり'))return q&&q.decoration!=='なし';if(c.includes('相手もメガネなし'))return q&&q.decoration!=='メガネ';
 if(c.includes('全員異なる射出順区分'))return all.length>0; // launch indices themselves are unique
 if(c.includes('爆発によって密集が解消'))return (ctx.victims?.length||0)>=4;
 // rare reunion-history clauses: approximated from recorded group memberships
 if(c.includes('全員が過去に同じグループへ所属')||c.includes('過去に5体以上のグループだった')||c.includes('元グループと同じ構成メンバー')||c.includes('再び同じメンバーだけで接着'))return all.length>=4&&all.every(x=>x.pocho.groupsHistory.length>0);
 if(c.includes('その後全員一度離散')||c.includes('全員完全にバラバラ')||c.includes('一定時間以上離散'))return all.every(x=>x.pocho.detachCount>0);
 if(c.includes('離散後それぞれ別のぽちょへ接触'))return all.every(x=>x.pocho.contacts.size>=2);if(c.includes('再集合')||c.includes('再び接着'))return ctx.trigger==='くっつく';if(c.includes('最後の1体加入で成立'))return ctx.newlyJoined===self||!!ctx.newlyJoined;
 if(c.includes('接着順が前回と異なる'))return true;
 if(c.includes('そのうち誰も弾けていない'))return true;
 if(c.includes('接着後に双方とも不機嫌へ表情変化'))return p.expressionChanges>0&&q?.expressionChanges>0&&p.expression==='不機嫌'&&q.expression==='不機嫌';
 if(c.includes('それぞれ別グループ所属')||c.includes('双方そのグループからも離脱'))return p.maxGroup>=2&&q?.maxGroup>=2&&p.detachCount>0&&q.detachCount>0;
 if(c.includes('長時間経過'))return age>=T.LONG;
 if(c.includes('現在も双方不機嫌'))return q&&p.expression==='不機嫌'&&q.expression==='不機嫌';
 if(c.includes('起爆ぽちょが全員と直接または間接接着'))return all.length>=2;
 if(c.includes('起爆ぽちょが過去に所属したグループの他メンバーが全員既に消滅'))return p.groupsHistory.length>0&&p.detachCount>0;
 if(c.includes('起爆ぽちょは直前まで低速'))return sv<T.LOW;
 if(c.includes('衝突相手とは初対面'))return rec?.count<=1;
 if(c.includes('3体すべて異色'))return ctx.groupAfter?.length===3&&new Set(ctx.groupAfter.map(x=>x.pocho.color)).size===3;
 if(c.includes('表情が3種類すべて揃う'))return ctx.groupAfter?.length>=3&&new Set(ctx.groupAfter.map(x=>x.pocho.expression)).size===3;
 if(c.includes('サイズ区分も3種類すべて揃う'))return ctx.groupAfter?.length>=3&&new Set(ctx.groupAfter.map(x=>x.pocho.sizeClass)).size===3;
 if(c.includes('1秒以内')||c.includes('一定時間以内'))return true;
 if(c.includes('3体以上が順番に接着'))return recentEvents.filter(e=>e.type==='くっつく'&&now-e.time<1000).length>=2;
 if(c.includes('最終グループが3色以上'))return ctx.groupAfter&&new Set(ctx.groupAfter.map(x=>x.pocho.color)).size>=3;
 if(c.includes('自分だけ異表情'))return near.length>=2&&near.filter(x=>x.pocho.expression===p.expression).length===0;
 if(c.includes('相手は周囲の多数派表情')){if(!q)return false;const co={};near.forEach(x=>co[x.pocho.expression]=(co[x.pocho.expression]||0)+1);const max=Math.max(0,...Object.values(co));return (co[q.expression]||0)===max}
 if(c.includes('相手と同じ壁に触れた履歴がある'))return q&&['left','right','top','bottom'].some(k=>p.wall[k]>0&&q.wall[k]>0);
 if(c.includes('その後初接触'))return rec&&rec.count<=1;
 if(c.includes('相手の周囲に自分以外のふじがいる'))return q&&getNearby(other.position.x,other.position.y,T.NEAR,[self,other]).some(x=>x.pocho.color==='ふじ');
 if(c.includes('自分がグループの端')){let degree=0;for(const bond of bonds)if(bond.bodyA===self||bond.bodyB===self)degree++;return g.length>=2&&degree<=1;}
 if(c.includes('相手が装飾なし'))return q&&q.decoration==='なし';
 if(c.includes('相手が現在2体以上と接触中'))return og.length>=2;
 if(c.includes('接触相手が直前に別ぽちょと離れている'))return q&&q.lastEvent==='detach'&&now-q.lastEventAt<2500;
 if(c.includes('相手の表情が変化済み'))return q&&q.expressionChanges>0;
 if(c.includes('直前に別のぽちょへ触れていない')){const prev=self===ctx.a?ctx.prevContactIdA:ctx.prevContactIdB;return !prev||prev===q?.id;}
 if(c.includes('接着後に自分が多数派側へ入る'))return true;
 if(c.includes('過去2回とは違う位置帯'))return true;if(c.includes('現在表情が初回と異なる'))return p.expressionChanges>0;
 if(c.includes('一度も相互誘爆なし'))return true;
 if(c.includes('周囲に装飾付きが2体以上'))return near.filter(x=>x.pocho.decoration!=='なし').length>=2;if(c.includes('その中で自分だけ装飾あり'))return p.decoration!=='なし'&&near.every(x=>x.pocho.decoration==='なし');
 if(c.includes('グループ内に王冠なし'))return !og.some(x=>x.pocho.decoration==='王冠');if(c.includes('グループ内に芽付きなし'))return !og.some(x=>x.pocho.decoration==='芽');
 if(c.includes('一度グループの中心付近にいた')||c.includes('現在端にいる'))return p.everStuck;
 if(c.includes('過去に最大4体以上のグループへ所属'))return p.maxGroup>=4;
 if(c.includes('過去に3体以上を誘爆で見送っている'))return p.popWitnessed>=3;if(c.includes('自分は一度も誘爆されていない'))return true;
 if(c.includes('天井付近に一定時間滞在'))return p.wall.top>0&&age>T.LONG;
 if(c.includes('相手も長時間生存'))return q&&(now-q.bornAt)/1000>=T.LONG;
 if(c.includes('直前の接触で何も起きていない'))return p.lastEvent==='none';if(c.includes('直前イベントが「離れる」'))return p.lastEvent==='detach';
 if(c.includes('直前に別ぽちょへ衝突済み')||c.includes('直前の衝突から短時間以内'))return now-p.lastContactAt<1600;
 if(c.includes('その反動で今回の相手に接触')||c.includes('他ぽちょに押されて高速化')||c.includes('第三者へ衝突')){const prev=self===ctx.a?ctx.prevPushedByA:ctx.prevPushedByB;return prev&&prev!==q?.id&&now-p.lastPushAt<2000;}
 if(c.includes('下から高速で飛んできた相手'))return other&&other.velocity.y<0&&ov>=T.HIGH;
 if(c.includes('下方向へ動いている相手'))return other&&other.velocity.y>0;
 if(c.includes('接触時にほぼ同じ方向へ移動')){if(!other)return false;const dot=self.velocity.x*other.velocity.x+self.velocity.y*other.velocity.y;return dot>0}
 if(c.includes('今度は別相手')||c.includes('今回が別相手')||c.includes('別の相手'))return p.lastContactId!==q?.id||rec?.count<=1;
 if(c.includes('直前の接触相手と別の色'))return p.contactColors.length>=2&&p.contactColors.at(-2)!==q?.color;
 if(c.includes('今回の速度が過去接触時より高い')||c.includes('前回より高い速度'))return rec&&rv>=rec.maxSpeed*.9;
 if(c.includes('今度が過去接触済み相手')||c.includes('今回が過去接触済み相手'))return rec&&rec.count>=2;
 if(c.includes('今回が同じ相手との3回目以上'))return rec&&rec.count>=3;
 if(c.includes('同じ相手と連続3回衝突'))return rec&&rec.count>=3&&p.lastContactId===q?.id;
 if(c.includes('3回目だけ高速'))return rec&&rec.count>=3&&rv>=T.HIGH;
 if(c.includes('直近の接触色が「異色→異色→自色」')){const a=p.contactColors;if(a.length<3)return false;return a.at(-3)!==p.color&&a.at(-2)!==p.color&&a.at(-1)===p.color}
 if(c.includes('今回も自色'))return q&&q.color===p.color;
 if(c.includes('今回がそのどれかと同色'))return p.contactColors.slice(-4,-1).includes(q?.color);
 if(c.includes('今回の相手が初対面'))return rec&&rec.count<=1;
 if(c.includes('同色への接触が今回で2回目'))return p.sameColorContacts===2;
 if(c.includes('接触回数が一定以上')||c.includes('総接触回数が多い'))return p.contactCount>=6;
 if(c.includes('壁接触回数が一定以上'))return wallTotal(p)>=4;
 if(c.includes('過去の接触回数が多い')||c.includes('過去に何度も接触済み'))return rec&&rec.count>=4;
 if(c.includes('相手と連続接触中'))return rec&&now-rec.lastAt<600;
 if(c.includes('今回だけ速度が急上昇')||c.includes('今回だけ高速'))return rv>=T.HIGH;
 if(c.includes('同じ相手と短時間に')||c.includes('短時間に複数回'))return rec&&rec.count>=3&&now-rec.firstAt<6000;
 if(c.includes('長時間接着していた履歴'))return rec?.lastStickAt&&now-rec.lastStickAt>6000;
 if(c.includes('その後誰とも接触していない'))return now-p.lastContactAt<100; // evaluated during first new contact
 if(c.includes('変化後初めての接触')||c.includes('変化後初めての高速衝突'))return p.expressionChanges>0&&now-p.lastExpressionChange<4000;
 if(c.includes('変化後一定時間経過'))return p.expressionChanges>0&&now-p.lastExpressionChange>5000;
 if(c.includes('一度も弾け条件未成立'))return p.behaviorCandidateHits===0;
 return false;
}
 function layerAllowed(r){const key=r.layer+'-'+r.result.toLowerCase();const cb=document.querySelector('[data-layer="'+key+'"]');if(!cb?.checked)return false;if(r.status==='unimplemented')return false;if(r.active)return true;return $('#include-disabled').checked&&r.status==='disabled'}
 function shadowEligible(r){return r.status!=='unimplemented'}
 function evaluate(ctx){const shadow=[];for(const r of DATA.behaviorRules){if(!shadowEligible(r))continue;for(const self of[ctx.a,ctx.b]){const other=self===ctx.a?ctx.b:ctx.a;if(ruleAppliesAttribute(r,self)&&checkCondition(r.condition,ctx,self,other)){shadow.push(r);break}}}for(const r of shadow)stats.ruleShadow[r.id]=(stats.ruleShadow[r.id]||0)+1;
  for(const layer of LAYERS){const matches=[];for(const r of DATA.behaviorRules){if(r.layer!==layer||!layerAllowed(r))continue;for(const self of[ctx.a,ctx.b]){const other=self===ctx.a?ctx.b:ctx.a;if(!ruleAppliesAttribute(r,self))continue;if(r.result==='POP'&&simNow-(self.pocho.launchedAt||0)<T.POP_PROTECT*1000)continue;if(checkCondition(r.condition,ctx,self,other)){matches.push({r,self});break}}}if(matches.length){const chosen=matches.find(x=>x.r.result==='POP')||matches[0];ctx.primary=chosen.self;ctx.behaviorRule=chosen.r;stats.ruleActual[chosen.r.id]=(stats.ruleActual[chosen.r.id]||0)+1;return{outcome:chosen.r.result,layer,rule:chosen.r,shadow}}}return{outcome:'NONE',layer:'none',rule:null,shadow}}
 function recordGroups(g){const ids=g.map(x=>x.pocho.id).sort();for(const b of g){b.pocho.maxGroup=Math.max(b.pocho.maxGroup,g.length);b.pocho.groupsHistory.push(ids);if(b.pocho.groupsHistory.length>8)b.pocho.groupsHistory.shift()}}
 function stick(a,b,ctx){if(isBonded(a,b))return;const ga=getGroup(a),gb=getGroup(b),from=ga.length+'+'+gb.length;ctx.prePairStickCount=contactRec(a,b).stickCount||0;const len=(a.pocho.radius+b.pocho.radius)*.93,c=Constraint.create({bodyA:a,bodyB:b,length:len,stiffness:.055,damping:.14});c.pochoBond={createdAt:simNow,rest:len};Composite.add(engine.world,c);bonds.add(c);for(const[x,y]of[[a,b],[b,a]]){const p=x.pocho,r=contactRec(x,y);p.stickCount++;p.everStuck=true;p.aloneSince=simNow;r.everStuck=true;r.stickCount++;r.lastStickAt=simNow;r.lastStickExpression=p.expression}const g=getGroup(a);recordGroups(g);const key=from+'→'+g.length;stats.groupTransitions[key]=(stats.groupTransitions[key]||0)+1}
 function breakBond(c){const a=c.bodyA,b=c.bodyB;if(!a?.pocho||!b?.pocho)return;Composite.remove(engine.world,c);bonds.delete(c);for(const[x,y]of[[a,b],[b,a]]){x.pocho.detachCount++;x.pocho.aloneSince=simNow;contactRec(x,y).detachCount++}}
 function popGroup(origin){const victims=getGroup(origin);stats.popEvents++;stats.popVictims+=victims.length;for(const c of[...bonds])if(victims.includes(c.bodyA)||victims.includes(c.bodyB)){Composite.remove(engine.world,c);bonds.delete(c)}for(const b of victims){Composite.remove(engine.world,b);bodies.delete(b)}return victims.length}
 function processContact(a,b,pair,currentShot,totalShots){if(!a.pocho||!b.pocho||isBonded(a,b))return;const ctx=collisionContext(a,b,pair);for(const[self,other]of[[a,b],[b,a]]){const p=self.pocho,r=contactRec(self,other);r.count++;if(!r.firstAt)r.firstAt=simNow;r.lastAt=simNow;r.maxSpeed=Math.max(r.maxSpeed,ctx.relativeSpeed);p.contactCount++;p.lastContactAt=simNow;p.colorsSeen.add(other.pocho.color);p.expressionsSeen.add(other.pocho.expression);p.sizesSeen.add(other.pocho.sizeClass);if(other.pocho.decoration!=='なし')p.decorationsSeen.add(other.pocho.decoration);p.contactColors.push(other.pocho.color);if(p.contactColors.length>8)p.contactColors.shift();if(p.color===other.pocho.color)p.sameColorContacts++;else p.diffColorContacts++}
  const preDensity=bodies.size,preGA=getGroup(a).length,preGB=getGroup(b).length,res=evaluate(ctx);const out=res.outcome;stats.contacts++;stats.outcomes[out]++;if(res.layer!=='none'){stats.layer[res.layer]||(stats.layer[res.layer]={STICK:0,POP:0});stats.layer[res.layer][out]++}
  const sb=bucketSpeed(ctx.relativeSpeed),db=bucketDensity(preDensity),pb=bucketPhase(currentShot,totalShots);for(const[k,bucket]of[[sb,stats.speed],[db,stats.density],[pb,stats.phase]]){bucket[k].contacts++;bucket[k][out]++}
  let victims=0,postGroup=0;if(out==='STICK'){stick(a,b,ctx);postGroup=getGroup(a).length}else if(out==='POP'){victims=popGroup(ctx.primary||a)}
  const log={game:stats.games+1,shot:currentShot,outcome:out,layer:res.layer,rule:res.rule?.id||'',relativeSpeed:+ctx.relativeSpeed.toFixed(2),density:preDensity,groupA:preGA,groupB:preGB,groupAfter:postGroup,popVictims:victims,colorA:a.pocho?.color||'',colorB:b.pocho?.color||'',exprA:a.pocho?.expression||'',exprB:b.pocho?.expression||''};if(stats.logs.length<120000)stats.logs.push(log);
  opts.onContact?.({log,res,shadow:(res.shadow||[]).map(r=>({id:r.id,layer:r.layer,result:r.result,condition:r.condition})),actualRule:res.rule?{id:res.rule.id,layer:res.rule.layer,result:res.rule.result,condition:res.rule.condition}:null});
  if(a.pocho&&b.pocho){a.pocho.lastContactId=b.pocho.id;b.pocho.lastContactId=a.pocho.id;a.pocho.lastPushedBy=b.pocho.id;b.pocho.lastPushedBy=a.pocho.id;a.pocho.lastPushAt=b.pocho.lastPushAt=simNow}pushRecent({type:out==='POP'?'弾ける':out==='STICK'?'くっつく':'何も起こらない',time:simNow})}
 let currentShot=0;Events.on(engine,'collisionStart',ev=>{for(const pair of ev.pairs){const a=pair.bodyA,b=pair.bodyB;if(a.pocho&&b.pocho)processContact(a,b,pair,currentShot,shots)}});Events.on(engine,'collisionActive',ev=>{for(const pair of ev.pairs){let b=null;if(pair.bodyA===topWall&&pair.bodyB?.pocho)b=pair.bodyB;else if(pair.bodyB===topWall&&pair.bodyA?.pocho)b=pair.bodyA;if(b){if(simNow-b.pocho.wall.lastAt>180){b.pocho.wall.top++;b.pocho.wall.last='top';b.pocho.wall.lastAt=simNow;b.pocho.wall.sequence.push('top');trimSeq(b.pocho.wall.sequence,8)}if(b.velocity.y<0||Math.abs(b.velocity.y)<2)Body.setVelocity(b,{x:b.velocity.x*.28,y:0})}}});
 function launchVector(vx,vy,desc=makeDescriptor()){if(currentShot>=shots)return null;currentShot++;const b=makeBody(desc);Composite.add(engine.world,b);bodies.add(b);Body.setVelocity(b,{x:vx,y:vy});stats.shots++;opts.onLaunch?.({body:b,shot:currentShot,desc,velocity:{x:vx,y:vy}});return b}
 function launch(){if(currentShot>=shots)return null;const desc=makeDescriptor();let sx=0,sy=-1,spd=10;if(ai==='strong'){spd=rand(12.8,16.5);sx=rand(-.75,.75)}else if(ai==='weak'){spd=rand(3,8);sx=rand(-.55,.55)}else if(ai==='center'){spd=rand(8,14);const targetX=W/2+rand(-25,25),dx=targetX-W*.5,dy=-220,s=Math.hypot(dx,dy);sx=dx/s;sy=dy/s}else if(ai==='crowd'&&bodies.size>0){let tx=W/2,ty=H*.3,best=-1;for(const x of bodies){const near=getNearby(x.position.x,x.position.y,90,[]).length;if(near>best){best=near;tx=x.position.x;ty=x.position.y}}const dx=tx-W*.5,dy=ty-launchY,s=Math.max(1,Math.hypot(dx,dy));sx=dx/s;sy=dy/s;spd=rand(9,15)}else{spd=rand(5,16);sx=rand(-.8,.8)}if(ai!=='center'&&ai!=='crowd'){sy=-Math.sqrt(Math.max(.05,1-sx*sx))}return launchVector(sx*spd,sy*spd,desc)}
 function step(){simNow+=DT;wallChecks();for(const b of bodies){const p=b.pocho,dt=DT/1000;p.distance+=speed(b)*dt*60;p.maxSpeed=Math.max(p.maxSpeed,speed(b));if(speed(b)>=T.HIGH)p.highSpeedSeen=true;Body.applyForce(b,b.position,{x:0,y:-b.mass*PHYS.UP_FORCE});const m=speed(b);if(m>PHYS.MAX_SPEED){const s=PHYS.MAX_SPEED/m;Body.setVelocity(b,{x:b.velocity.x*s,y:b.velocity.y*s})}if(m<T.STILL){if(!p.stillSince)p.stillSince=simNow;if(simNow-p.stillSince>5000)p.longStill=true}else p.stillSince=0}for(const c of[...bonds]){if(!c.bodyA?.pocho||!c.bodyB?.pocho){bonds.delete(c);continue}const d=Math.hypot(c.bodyA.position.x-c.bodyB.position.x,c.bodyA.position.y-c.bodyB.position.y),rv=Math.hypot(c.bodyA.velocity.x-c.bodyB.velocity.x,c.bodyA.velocity.y-c.bodyB.velocity.y);if(simNow-c.pochoBond.createdAt>450&&(d>c.pochoBond.rest*1.82||rv>13.2))breakBond(c)}Engine.update(engine,DT);stats.maxBodies=Math.max(stats.maxBodies,bodies.size);stats.bodySum+=bodies.size;stats.bodySamples++;let mg=1,seen=new Set();for(const b of bodies){if(seen.has(b))continue;const g=getGroup(b);g.forEach(x=>seen.add(x));mg=Math.max(mg,g.length);stats.groupSum+=g.length;stats.groupSamples++;if(g.length>=5)stats.largeGroupSamples++}stats.maxGroup=Math.max(stats.maxGroup,mg)}
 return{async run(onProgress){for(let s=1;s<=shots;s++){if(stopFlag)break;launch();for(let i=0;i<24;i++){step();if((i&7)===7)await new Promise(r=>setTimeout(r,0));}if(onProgress)onProgress(s,shots);await new Promise(r=>setTimeout(r,0));}if(!stopFlag){for(let i=0;i<180;i++){step();if((i&15)===15)await new Promise(r=>setTimeout(r,0));}}stats.games++;return bodies.size},step,launchAuto:launch,launchVector,getBodies:()=>[...bodies],getBonds:()=>[...bonds],getCurrentShot:()=>currentShot,getSimTime:()=>simNow,makeDescriptor}}
function pct(n,d){return d?((n/d)*100).toFixed(1)+'%':'0.0%'}
function setupToggles(){const box=$('#layer-toggles');for(const layer of LAYERS){const div=document.createElement('div');div.className='layer';div.innerHTML='<b>'+LABEL[layer]+'</b><label><input type="checkbox" data-layer="'+layer+'-stick" checked> STICK</label><label><input type="checkbox" data-layer="'+layer+'-pop" '+((layer==='size'||layer==='expression')?'':'checked')+'> POP</label>';box.appendChild(div)}}
async function runAll(){
 try{
  stopFlag=false;$('#run').disabled=true;$('#stop').disabled=false;$('#csv').disabled=true;$('#summary-csv').disabled=true;
  $('#bar').style.width='0%';$('#status').textContent='準備中…';await new Promise(r=>setTimeout(r,30));
  rng=seedRandom($('#seed').value);const games=Math.max(1,Math.min(1000,+$('#games').value||1)),shots=+$('#mode').value,ai=$('#ai').value,stats=emptyStats();lastStats=stats;const start=performance.now();
  for(let g=0;g<games&&!stopFlag;g++){
   $('#status').textContent=`実行中：${g+1} / ${games} games ・ 0 / ${shots} shots ・ ${stats.contacts.toLocaleString()} contacts`;
   const w=createWorld(stats,shots,ai);
   await w.run((shot,total)=>{const gp=(g+(shot/total))/games;$('#bar').style.width=(gp*100).toFixed(1)+'%';$('#status').textContent=`実行中：${g+1} / ${games} games ・ ${shot} / ${total} shots ・ ${stats.contacts.toLocaleString()} contacts`;if(shot%3===0)render(stats)});
   render(stats);await new Promise(r=>setTimeout(r,0));
  }
  render(stats);lastLogs=stats.logs;$('#bar').style.width=(stopFlag?stats.games/games*100:100)+'%';$('#status').textContent=(stopFlag?'停止':'完了')+`：${stats.games} games / ${stats.shots.toLocaleString()} shots / ${stats.contacts.toLocaleString()} contacts / ${((performance.now()-start)/1000).toFixed(1)} sec`;$('#csv').disabled=!stats.logs.length;$('#summary-csv').disabled=!stats.contacts;
 }catch(err){console.error(err);$('#status').textContent='エラー：'+(err?.message||String(err));$('#status').classList.add('error');alert('POCHO LABでエラーが発生しました：'+(err?.message||String(err)));}
 finally{$('#run').disabled=false;$('#stop').disabled=true;}
}
function render(stats){const c=stats.contacts;$('#none-pct').textContent=pct(stats.outcomes.NONE,c);$('#stick-pct').textContent=pct(stats.outcomes.STICK,c);$('#pop-pct').textContent=pct(stats.outcomes.POP,c);$('#none-count').textContent=stats.outcomes.NONE.toLocaleString();$('#stick-count').textContent=stats.outcomes.STICK.toLocaleString();$('#pop-count').textContent=stats.outcomes.POP.toLocaleString();$('#contacts').textContent=c.toLocaleString();$('#shots').textContent=stats.shots.toLocaleString()+' shots';const avgBodies=stats.bodySamples?stats.bodySum/stats.bodySamples:0,avgGroup=stats.groupSamples?stats.groupSum/stats.groupSamples:0,large=stats.groupSamples?stats.largeGroupSamples/stats.groupSamples:0,avgVictims=stats.popEvents?stats.popVictims/stats.popEvents:0;$('#growth').innerHTML=metric('平均盤面個体',avgBodies.toFixed(2))+metric('最大盤面個体',stats.maxBodies)+metric('平均グループ',avgGroup.toFixed(2))+metric('最大グループ',stats.maxGroup)+metric('5体以上率',pct(stats.largeGroupSamples,stats.groupSamples))+metric('1POP平均消滅',avgVictims.toFixed(2));$('#layer-table').innerHTML=layerTable(stats);$('#speed-table').innerHTML=bucketTable(stats.speed);$('#density-table').innerHTML=bucketTable(stats.density);$('#phase-table').innerHTML=bucketTable(stats.phase);$('#rule-table').innerHTML=ruleTable(stats);$('#group-table').innerHTML=groupTable(stats)}
function metric(a,b){return`<div class="metric"><small>${a}</small><b>${b}</b></div>`}function outcomeCells(x){return`<td>${pct(x.NONE,x.contacts)}</td><td>${pct(x.STICK,x.contacts)}</td><td>${pct(x.POP,x.contacts)}</td>`}
function bucketTable(o){let h='<table class="tbl"><tr><th>区分</th><th>接触</th><th>NONE</th><th>STICK</th><th>POP</th></tr>';for(const[k,v]of Object.entries(o))h+=`<tr><td>${k}</td><td>${v.contacts.toLocaleString()}</td>${outcomeCells(v)}</tr>`;return h+'</table>'}
function layerTable(s){let h='<table class="tbl"><tr><th>レイヤー</th><th>STICK</th><th>POP</th><th>全接触比</th></tr>';for(const l of LAYERS){const v=s.layer[l]||{STICK:0,POP:0},n=v.STICK+v.POP;h+=`<tr><td>${LABEL[l]}</td><td>${v.STICK}</td><td>${v.POP}</td><td>${pct(n,s.contacts)}</td></tr>`}return h+'</table>'}
function ruleTable(s){const rules=DATA.behaviorRules.map(r=>({r,shadow:s.ruleShadow[r.id]||0,actual:s.ruleActual[r.id]||0})).filter(x=>x.shadow||x.actual).sort((a,b)=>b.shadow-a.shadow).slice(0,30);let h='<table class="tbl"><tr><th>条件</th><th>結果</th><th>層</th><th>裏成立</th><th>裏成立率</th><th>採用</th></tr>';for(const x of rules){const risky=s.contacts&&x.shadow/s.contacts>.1?' class="warn"':'';h+=`<tr${risky}><td>${x.r.id}<br><small>${x.r.condition}</small></td><td>${x.r.result}</td><td>${LABEL[x.r.layer]}</td><td>${x.shadow}</td><td>${pct(x.shadow,s.contacts)}</td><td>${x.actual}</td></tr>`}return h+'</table>'}
function groupTable(s){const rows=Object.entries(s.groupTransitions).sort((a,b)=>b[1]-a[1]);let h='<table class="tbl"><tr><th>接着前 → 接着後</th><th>回数</th><th>STICK内比率</th></tr>';for(const[k,v]of rows)h+=`<tr><td>${k}</td><td>${v}</td><td>${pct(v,s.outcomes.STICK)}</td></tr>`;return h+'</table>'}
function download(name,text,type='text/csv'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function logsCsv(){if(!lastLogs.length)return;const keys=Object.keys(lastLogs[0]),rows=[keys.join(','),...lastLogs.map(x=>keys.map(k=>'"'+String(x[k]??'').replaceAll('"','""')+'"').join(','))];download('pocho_contact_log.csv','\ufeff'+rows.join('\n'))}
function summaryCsv(){const s=lastStats;if(!s)return;const rows=[['metric','value'],['games',s.games],['shots',s.shots],['contacts',s.contacts],['none_rate',pct(s.outcomes.NONE,s.contacts)],['stick_rate',pct(s.outcomes.STICK,s.contacts)],['pop_rate',pct(s.outcomes.POP,s.contacts)],['avg_bodies',s.bodySamples?s.bodySum/s.bodySamples:0],['max_bodies',s.maxBodies],['avg_group',s.groupSamples?s.groupSum/s.groupSamples:0],['max_group',s.maxGroup],['avg_pop_victims',s.popEvents?s.popVictims/s.popEvents:0]];download('pocho_summary.csv','\ufeff'+rows.map(r=>r.join(',')).join('\n'))}
window.POCHO_LAB_INTERNAL={createWorld,emptyStats,seedRandom,setSeed:(seed)=>{rng=seedRandom(seed)},getStats:()=>lastStats,constants:{W,H,launchY,DT,T,PHYS,LABEL,LAYERS,COLORS,EXPRESSIONS}};
window.addEventListener('error',e=>{const st=$('#status');if(st)st.textContent='エラー：'+(e.message||'不明なJavaScriptエラー');console.error(e.error||e)});window.addEventListener('unhandledrejection',e=>{const st=$('#status');if(st)st.textContent='エラー：'+(e.reason?.message||String(e.reason));console.error(e.reason)});setupToggles();$('#run').onclick=runAll;$('#stop').onclick=()=>stopFlag=true;$('#csv').onclick=logsCsv;$('#summary-csv').onclick=summaryCsv;
})();