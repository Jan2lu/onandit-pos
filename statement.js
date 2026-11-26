/* Billing statement PDF writer. No libraries needed.
   makeStatementPdf({biz, date, groups}) -> Uint8Array (a real PDF file)
   biz:    {name, addr, phone, payInfo, footer, cur}
   groups: [{name, phone, address, rows:[{no,date,due,overdue,desc,total,paid,bal}]}]  one statement per group */
(function(){
const HW=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HB=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const asc=t=>String(t==null?'':t).replace(/₱/g,'PHP ').replace(/×/g,'x').replace(/[−–—·•]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').replace(/[^\x20-\x7e]/g,'?').trim();
const W=(s,sz,b)=>{const t=b?HB:HW;let w=0;for(let i=0;i<s.length;i++)w+=t[s.charCodeAt(i)-32]||556;return w*sz/1000};
const wrap=(s,sz,b,mw)=>{s=asc(s);if(!s)return[''];const out=[];let l='';
  const push=()=>{out.push(l);l=''};
  s.split(' ').forEach(wd=>{
    while(W(wd,sz,b)>mw){let k=wd.length;while(k>1&&W(wd.slice(0,k),sz,b)>mw)k--;if(l)push();out.push(wd.slice(0,k));wd=wd.slice(k)}
    const t=l?l+' '+wd:wd;if(W(t,sz,b)>mw&&l){push();l=wd}else l=t});
  if(l)out.push(l);return out};
const hex=h=>{h=h.replace('#','');return[0,2,4].map(i=>(parseInt(h.substr(i,2),16)/255).toFixed(3)).join(' ')};
const esc=s=>s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const f2=n=>(Math.round(n*100)/100).toFixed(2);
const num=n=>(Math.round(n*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

const PW=595.28,PH=841.89,M=40,CW=PW-2*M;
const INK='#18181b',MUT='#71717a',PINK='#c41488',PINK2='#dc3fa5',PINKBG='#fdf0f9',PINKBD='#f5c3e4',LINE='#e4e4e7',LT='#efa0d3';

function Doc(){this.pages=[];this.cur=null}
Doc.prototype.page=function(){this.cur=[];this.pages.push(this.cur);return this.pages.length-1};
Doc.prototype.at=function(i){this.cur=this.pages[i]};
Doc.prototype.rect=function(x,y,w,h,fill,stroke,lw){ // y = top, measured from top of page
  const o=[];if(fill)o.push(hex(fill)+' rg');if(stroke)o.push(hex(stroke)+' RG '+(lw||0.8)+' w');
  o.push(f2(x)+' '+f2(PH-y-h)+' '+f2(w)+' '+f2(h)+' re '+(fill&&stroke?'B':fill?'f':'S'));this.cur.push(o.join(' '))};
Doc.prototype.line=function(x1,y1,x2,y2,col,lw){this.cur.push(hex(col)+' RG '+(lw||0.6)+' w '+f2(x1)+' '+f2(PH-y1)+' m '+f2(x2)+' '+f2(PH-y2)+' l S')};
Doc.prototype.text=function(s,x,y,sz,b,col,al){ // y = baseline from top
  s=asc(s);if(!s)return;const w=W(s,sz,b);if(al==='r')x-=w;else if(al==='c')x-=w/2;
  this.cur.push('BT '+hex(col||INK)+' rg /'+(b?'F2':'F1')+' '+sz+' Tf '+f2(x)+' '+f2(PH-y)+' Td ('+esc(s)+') Tj ET')};
Doc.prototype.image=function(x,y,w,h){this.cur.push('q '+f2(w)+' 0 0 '+f2(h)+' '+f2(x)+' '+f2(PH-y-h)+' cm /Im1 Do Q')};

function build(doc,title,logo){
  const parts=[],offs=[];let len=0;
  const put=s=>{const a=typeof s==='string'?Uint8Array.from(s,c=>c.charCodeAt(0)&255):s;parts.push(a);len+=a.length};
  const obj=(n,body)=>{offs[n]=len;put(n+' 0 obj\n');if(typeof body==='string')put(body);else body();put('\nendobj\n')};
  put('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  const n=doc.pages.length,hasImg=!!logo;
  // object ids: 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, 6 image(optional), then pairs (content, page)
  const first=hasImg?7:6;
  const kids=doc.pages.map((_,i)=>(first+i*2+1)+' 0 R').join(' ');
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids ['+kids+'] /Count '+n+' >>');
  obj(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  obj(5,'<< /Title ('+esc(asc(title))+') /Producer (On&iT POS) >>');
  if(hasImg)obj(6,()=>{put('<< /Type /XObject /Subtype /Image /Width '+logo.w+' /Height '+logo.h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+logo.bytes.length+' >>\nstream\n');put(logo.bytes);put('\nendstream')});
  doc.pages.forEach((ops,i)=>{
    const c=first+i*2,p=c+1,s=ops.join('\n');
    obj(c,()=>{put('<< /Length '+s.length+' >>\nstream\n');put(s);put('\nendstream')});
    obj(p,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+PW+' '+PH+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>'+(hasImg?' /XObject << /Im1 6 0 R >>':'')+' >> /Contents '+c+' 0 R >>');
  });
  const total=first+n*2,xr=len;
  put('xref\n0 '+total+'\n0000000000 65535 f \n');
  for(let i=1;i<total;i++)put(String(offs[i]).padStart(10,'0')+' 00000 n \n');
  put('trailer\n<< /Size '+total+' /Root 1 0 R /Info 5 0 R >>\nstartxref\n'+xr+'\n%%EOF\n');
  const out=new Uint8Array(len);let o=0;parts.forEach(a=>{out.set(a,o);o+=a.length});return out;
}

window.makeStatementPdf=function(o){
  const biz=o.biz||{},cur=(biz.cur&&biz.cur!=='₱')?asc(biz.cur):'PHP';
  const money=n=>cur+' '+num(n);
  let logo=null;
  if(window.LOGO_DATA){try{const bin=atob(window.LOGO_DATA.b64),b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);logo={w:window.LOGO_DATA.w,h:window.LOGO_DATA.h,bytes:b}}catch(e){logo=null}}
  const doc=new Doc(),spans=[];
  const FOOT=PH-44;           // content must stay above this
  const store=asc(biz.name||'');

  function bigHeader(g){
    doc.rect(0,0,PW,96,'#000000');
    if(logo){const h=62,w=h*logo.w/logo.h;doc.image(M,17,w,h)}else doc.text(store,M,56,20,true,'#ffffff');
    doc.text('BILLING STATEMENT',PW-M,48,19,true,'#ffffff','r');
    doc.text('Statement date: '+o.date,PW-M,67,9.5,false,LT,'r');
    if(g.ctrl)doc.text('Control No. '+g.ctrl,PW-M,83,10.5,true,'#ffffff','r');
    doc.rect(0,96,PW,4,PINK2);
  }
  function smallHeader(g){
    doc.rect(0,0,PW,34,'#000000');doc.rect(0,34,PW,3,PINK2);
    doc.text(store,M,22,11,true,'#ffffff');
    doc.text('Billing statement - '+g.name+' (continued)',PW-M,22,9,false,LT,'r');
  }
  const COLS=[ // label, width, align
    ['Order',44,'l'],['Date',58,'l'],['Due',58,'l'],['Items',0,'l'],['Total',60,'r'],['Paid',60,'r'],['Balance',66,'r']];
  COLS[3][1]=CW-COLS.reduce((a,c)=>a+c[1],0);
  const colX=[];{let x=M;COLS.forEach(c=>{colX.push(x);x+=c[1]})}
  function tableHead(y){
    doc.rect(M,y,CW,19,'#000000');
    COLS.forEach((c,i)=>{const pad=5;const tx=c[2]==='r'?colX[i]+c[1]-pad:colX[i]+pad;doc.text(c[0],tx,y+12.6,8.2,true,'#ffffff',c[2])});
    return y+19;
  }

  o.groups.forEach(g=>{
    const startPage=doc.page();bigHeader(g);
    let y=126;
    // BILL TO / FROM
    const L=[],R=[];
    doc.text('BILL TO',M,y,8,true,PINK);doc.text('FROM',320,y,8,true,PINK);
    let ly=y+16;
    wrap(g.name||'Walk-in',13,true,250).forEach(t=>{doc.text(t,M,ly,13,true,INK);ly+=16});
    if(g.phone){doc.text(g.phone,M,ly,9.5,false,INK);ly+=13}
    if(g.address)wrap(g.address,9.5,false,250).forEach(t=>{doc.text(t,M,ly,9.5,false,MUT);ly+=13});
    let ry=y+16;
    wrap(store,11,true,235).forEach(t=>{doc.text(t,320,ry,11,true,INK);ry+=14});
    if(biz.addr)wrap(biz.addr,9.5,false,235).forEach(t=>{doc.text(t,320,ry,9.5,false,MUT);ry+=13});
    if(biz.phone){doc.text(biz.phone,320,ry,9.5,false,INK);ry+=13}
    y=Math.max(ly,ry)+8;
    // total box
    const totalDue=g.rows.reduce((a,r)=>a+r.bal,0);
    doc.rect(M,y,CW,50,PINKBG,PINKBD,1);
    doc.rect(M,y,5,50,PINK);
    doc.text('TOTAL AMOUNT DUE',M+18,y+22,9,true,PINK);
    doc.text(g.rows.length+(g.rows.length===1?' unpaid order':' unpaid orders'),M+18,y+38,9,false,MUT);
    doc.text(money(totalDue),PW-M-14,y+34,22,true,INK,'r');
    y+=50+20;
    y=tableHead(y);
    // rows
    g.rows.forEach((r,idx)=>{
      const dl=wrap(r.desc||'-',8.6,false,COLS[3][1]-10);
      const rh=Math.max(dl.length*11.2+9,24);
      if(y+rh>FOOT-4){doc.page();smallHeader(g);y=tableHead(52)}
      if(idx%2===1)doc.rect(M,y,CW,rh,'#fafafa');
      const by=y+14;
      doc.text(r.no,colX[0]+5,by,8.6,true,INK);
      doc.text(r.date,colX[1]+5,by,8.4,false,INK);
      doc.text(r.due||'-',colX[2]+5,by,8.4,!!r.overdue,r.overdue?PINK:INK);
      dl.forEach((t,k)=>doc.text(t,colX[3]+5,by+k*11.2,8.6,false,INK));
      doc.text(num(r.total),colX[4]+COLS[4][1]-5,by,8.6,false,INK,'r');
      doc.text(num(r.paid),colX[5]+COLS[5][1]-5,by,8.6,false,INK,'r');
      doc.text(num(r.bal),colX[6]+COLS[6][1]-5,by,8.6,true,INK,'r');
      doc.line(M,y+rh,M+CW,y+rh,LINE,0.6);
      y+=rh;
    });
    // totals + how to pay
    const billed=g.rows.reduce((a,r)=>a+r.total,0),pd=g.rows.reduce((a,r)=>a+r.paid,0);
    const payLines=biz.payInfo?String(biz.payInfo).split(/\r?\n/).flatMap(l=>wrap(l,9.5,false,CW-24)):[];
    const hasLate=g.rows.some(r=>r.overdue);
    const need=100+(payLines.length?payLines.length*13+34:0)+(hasLate?16:0);
    if(y+need>FOOT){doc.page();smallHeader(g);y=56}
    y+=16;
    const tx1=PW-M-215,tx2=PW-M-6;
    doc.text('Total billed',tx1,y,9.5,false,MUT);doc.text(money(billed),tx2,y,9.5,false,INK,'r');y+=15;
    doc.text('Total paid so far',tx1,y,9.5,false,MUT);doc.text('- '+money(pd),tx2,y,9.5,false,INK,'r');y+=8;
    doc.line(tx1,y,PW-M,y,INK,1);y+=17;
    doc.text('BALANCE DUE',tx1,y,11,true,PINK);doc.text(money(totalDue),tx2,y,13,true,PINK,'r');y+=14;
    if(hasLate){doc.text('Due dates shown in pink are overdue.',M,y,8.4,false,PINK);y+=14}
    if(payLines.length){
      y+=10;
      const bh=payLines.length*13+30;
      doc.rect(M,y,CW,bh,'#ffffff',LINE,1);
      doc.text('HOW TO PAY',M+12,y+17,8.5,true,PINK);
      payLines.forEach((t,k)=>doc.text(t,M+12,y+33+k*13,9.5,false,INK));
      y+=bh;
    }
    if(biz.footer){y+=18;doc.text(biz.footer,PW/2,y,9.5,true,MUT,'c')}
    spans.push([startPage,doc.pages.length-1,g.name,g]);
  });
  // footers with "Page x of y" per statement
  spans.forEach(([a,b,name,g0])=>{
    for(let p=a;p<=b;p++){doc.at(p);
      doc.line(M,PH-34,PW-M,PH-34,LINE,0.6);
      doc.text(store+'  -  Statement for '+asc(name),M,PH-21,7.8,false,MUT);
      doc.text((g0.ctrl?g0.ctrl+'  -  ':'')+'Page '+(p-a+1)+' of '+(b-a+1),PW-M,PH-21,7.8,false,MUT,'r');
    }
  });
  return build(doc,'Billing statement - '+(o.groups.length===1?o.groups[0].name:o.groups.length+' customers'),logo);
};

window.makeDeliveryPdf=function(o){
  const biz=o.biz||{},cur=(biz.cur&&biz.cur!=='₱')?asc(biz.cur):'PHP',money=n=>cur+' '+num(n),store=asc(biz.name||'');
  let logo=null;
  if(window.LOGO_DATA){try{const bin=atob(window.LOGO_DATA.b64),b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);logo={w:window.LOGO_DATA.w,h:window.LOGO_DATA.h,bytes:b}}catch(e){logo=null}}
  const doc=new Doc(),spans=[],FOOT=PH-44;
  o.groups.forEach(g=>{
    const sp=doc.page();
    doc.rect(0,0,PW,96,'#000000');
    if(logo){const h=62,w=h*logo.w/logo.h;doc.image(M,17,w,h)}else doc.text(store,M,56,20,true,'#ffffff');
    doc.text('DELIVERY RECEIPT',PW-M,48,19,true,'#ffffff','r');
    doc.text('Date: '+o.date,PW-M,67,9.5,false,LT,'r');
    if(g.ctrl)doc.text('Control No. '+g.ctrl,PW-M,83,10.5,true,'#ffffff','r');
    doc.rect(0,96,PW,4,PINK2);
    let y=126;
    doc.text('DELIVER TO',M,y,8,true,PINK);doc.text('FROM',320,y,8,true,PINK);
    let ly=y+16;
    wrap(g.name||'Walk-in',13,true,250).forEach(t=>{doc.text(t,M,ly,13,true,INK);ly+=16});
    if(g.phone){doc.text(g.phone,M,ly,9.5,false,INK);ly+=13}
    if(g.address)wrap(g.address,9.5,false,250).forEach(t=>{doc.text(t,M,ly,9.5,false,MUT);ly+=13});
    let ry=y+16;
    wrap(store,11,true,235).forEach(t=>{doc.text(t,320,ry,11,true,INK);ry+=14});
    if(biz.addr)wrap(biz.addr,9.5,false,235).forEach(t=>{doc.text(t,320,ry,9.5,false,MUT);ry+=13});
    if(biz.phone){doc.text(biz.phone,320,ry,9.5,false,INK);ry+=13}
    y=Math.max(ly,ry)+6;
    const refs='Order'+(g.orders.length>1?'s':'')+': '+g.orders.map(x=>x.no).join(', ');
    wrap(refs,9.5,true,CW).forEach(t=>{doc.text(t,M,y+10,9.5,true,INK);y+=13});
    y+=14;
    const COLS=[['Order',46,'l'],['Item',0,'l'],['Qty',44,'r'],['Unit price',68,'r'],['Amount',74,'r']];
    COLS[1][1]=CW-COLS.reduce((a,c)=>a+c[1],0);
    const cx=[];{let x=M;COLS.forEach(c=>{cx.push(x);x+=c[1]})}
    const head=yy=>{doc.rect(M,yy,CW,19,'#000000');COLS.forEach((c,i)=>doc.text(c[0],c[2]==='r'?cx[i]+c[1]-5:cx[i]+5,yy+12.6,8.2,true,'#ffffff',c[2]));return yy+19};
    const small=()=>{doc.page();doc.rect(0,0,PW,34,'#000000');doc.rect(0,34,PW,3,PINK2);doc.text(store,M,22,11,true,'#ffffff');doc.text('Delivery receipt - '+g.name+' (continued)',PW-M,22,9,false,LT,'r')};
    y=head(y);
    g.orders.forEach(od=>{
      od.items.forEach((it,k)=>{
        const dl=wrap(it.name,8.8,false,COLS[1][1]-10),rh=Math.max(dl.length*11.2+9,23);
        if(y+rh>FOOT-4){small();y=head(52)}
        doc.text(k===0?od.no:'',cx[0]+5,y+14,8.6,true,INK);
        dl.forEach((t,j)=>doc.text(t,cx[1]+5,y+14+j*11.2,8.8,false,INK));
        doc.text(String(it.qty),cx[2]+COLS[2][1]-5,y+14,9.2,true,INK,'r');
        doc.text(num(it.price),cx[3]+COLS[3][1]-5,y+14,8.6,false,INK,'r');
        doc.text(num(it.qty*it.price),cx[4]+COLS[4][1]-5,y+14,8.6,false,INK,'r');
        doc.line(M,y+rh,M+CW,y+rh,LINE,0.6);y+=rh;
      });
      if(od.note){const nl=wrap('Note: '+od.note,8.4,false,CW-60);const rh=nl.length*11+7;
        if(y+rh>FOOT-4){small();y=head(52)}
        nl.forEach((t,j)=>doc.text(t,cx[1]+5,y+12+j*11,8.4,false,MUT));doc.line(M,y+rh,M+CW,y+rh,LINE,0.6);y+=rh}
    });
    // totals
    const sub=g.orders.reduce((a,x)=>a+x.sub,0),disc=g.orders.reduce((a,x)=>a+x.disc,0),tot=g.orders.reduce((a,x)=>a+x.total,0),pd=g.orders.reduce((a,x)=>a+x.paid,0),bl=g.orders.reduce((a,x)=>a+x.bal,0);
    const taxT=g.orders.reduce((a,x)=>a+(x.tax||0),0),taxLbl=[...new Set(g.orders.filter(x=>x.tax).map(x=>x.taxLabel||'Tax'))].join(' / ')||'Tax';
    const nQty=g.orders.reduce((a,x)=>a+x.items.reduce((b,i)=>b+i.qty,0),0);
    if(y+250>FOOT){small();y=56}
    y+=8;doc.text('Total quantity delivered: '+nQty,M,y+8,9.5,true,INK);
    y+=10;const t1=PW-M-215,t2=PW-M-6;
    if(disc>0||taxT>0){doc.text('Subtotal',t1,y+8,9.5,false,MUT);doc.text(money(sub),t2,y+8,9.5,false,INK,'r');y+=15}
    if(disc>0){doc.text('Discount',t1,y+8,9.5,false,MUT);doc.text('- '+money(disc),t2,y+8,9.5,false,INK,'r');y+=15}
    if(taxT>0){doc.text('Less: '+taxLbl,t1,y+8,9.5,false,MUT);doc.text('- '+money(taxT),t2,y+8,9.5,false,INK,'r');y+=15}
    doc.text('Order total',t1,y+8,9.5,false,MUT);doc.text(money(tot),t2,y+8,9.5,false,INK,'r');y+=15;
    doc.text('Paid',t1,y+8,9.5,false,MUT);doc.text('- '+money(pd),t2,y+8,9.5,false,INK,'r');y+=11;
    doc.line(t1,y,PW-M,y,INK,1);y+=17;
    if(bl>0){doc.text('BALANCE TO COLLECT',t1,y,10.5,true,PINK);doc.text(money(bl),t2,y,13,true,PINK,'r')}
    else{doc.text('PAID IN FULL',t1,y,11,true,PINK);doc.text(money(0),t2,y,13,true,PINK,'r')}
    y+=26;
    // signatures
    doc.text('Received the above items in good order and condition.',M,y,9.5,false,INK);y+=40;
    const sw=(CW-40)/3,sx=[M,M+sw+20,M+2*(sw+20)],lab=['Delivered by (name & signature)','Received by (name & signature)','Date received'];
    sx.forEach((x,i)=>{doc.line(x,y,x+sw,y,INK,0.8);doc.text(lab[i],x,y+12,8.2,false,MUT)});
    y+=34;
    if(biz.footer){doc.text(biz.footer,PW/2,y+4,9.5,true,MUT,'c')}
    spans.push([sp,doc.pages.length-1,g.name,g]);
  });
  spans.forEach(([a,b,name,g0])=>{for(let p=a;p<=b;p++){doc.at(p);doc.line(M,PH-34,PW-M,PH-34,LINE,0.6);
    doc.text(store+'  -  Delivery receipt for '+asc(name),M,PH-21,7.8,false,MUT);
    doc.text((g0.ctrl?g0.ctrl+'  -  ':'')+'Page '+(p-a+1)+' of '+(b-a+1),PW-M,PH-21,7.8,false,MUT,'r')}});
  return build(doc,'Delivery receipt - '+o.groups[0].name,logo);
};

window.makeReceiptPdf=function(o){
  const biz=o.biz||{},cur=(biz.cur&&biz.cur!=='₱')?asc(biz.cur):'PHP',money=n=>cur+' '+num(n),store=asc(biz.name||''),r=o.order;
  let logo=null;
  if(window.LOGO_DATA){try{const bin=atob(window.LOGO_DATA.b64),b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);logo={w:window.LOGO_DATA.w,h:window.LOGO_DATA.h,bytes:b}}catch(e){logo=null}}
  const doc=new Doc(),FOOT=PH-44;
  const sp=doc.page();
  doc.rect(0,0,PW,96,'#000000');
  if(logo){const h=62,w=h*logo.w/logo.h;doc.image(M,17,w,h)}else doc.text(store,M,56,20,true,'#ffffff');
  doc.text('RECEIPT',PW-M,48,19,true,'#ffffff','r');
  doc.text('Date: '+r.date,PW-M,67,9.5,false,LT,'r');
  doc.text('Receipt No. '+r.no,PW-M,83,10.5,true,'#ffffff','r');
  doc.rect(0,96,PW,4,PINK2);
  let y=126;
  doc.text('RECEIVED FROM',M,y,8,true,PINK);doc.text('FROM',320,y,8,true,PINK);
  let ly=y+16;
  wrap(r.name||'Walk-in',13,true,250).forEach(t=>{doc.text(t,M,ly,13,true,INK);ly+=16});
  if(r.phone){doc.text(r.phone,M,ly,9.5,false,INK);ly+=13}
  if(r.address)wrap(r.address,9.5,false,250).forEach(t=>{doc.text(t,M,ly,9.5,false,MUT);ly+=13});
  let ry=y+16;
  wrap(store,11,true,235).forEach(t=>{doc.text(t,320,ry,11,true,INK);ry+=14});
  if(biz.addr)wrap(biz.addr,9.5,false,235).forEach(t=>{doc.text(t,320,ry,9.5,false,MUT);ry+=13});
  if(biz.phone){doc.text(biz.phone,320,ry,9.5,false,INK);ry+=13}
  y=Math.max(ly,ry)+6;
  if(r.due){doc.text('Due date: '+r.due,M,y+10,9.5,false,INK);y+=13}
  y+=14;
  const COLS=[['Item',0,'l'],['Qty',44,'r'],['Unit price',74,'r'],['Amount',80,'r']];
  COLS[0][1]=CW-COLS.reduce((a,c)=>a+c[1],0);
  const cx=[];{let x=M;COLS.forEach(c=>{cx.push(x);x+=c[1]})}
  const head=yy=>{doc.rect(M,yy,CW,19,'#000000');COLS.forEach((c,i)=>doc.text(c[0],c[2]==='r'?cx[i]+c[1]-5:cx[i]+5,yy+12.6,8.2,true,'#ffffff',c[2]));return yy+19};
  const small=()=>{doc.page();doc.rect(0,0,PW,34,'#000000');doc.rect(0,34,PW,3,PINK2);doc.text(store,M,22,11,true,'#ffffff');doc.text('Receipt '+r.no+' (continued)',PW-M,22,9,false,LT,'r')};
  y=head(y);
  r.items.forEach(it=>{
    const dl=wrap(it.name,9,false,COLS[0][1]-10),rh=Math.max(dl.length*11.5+10,24);
    if(y+rh>FOOT-4){small();y=head(52)}
    dl.forEach((t,j)=>doc.text(t,cx[0]+5,y+15+j*11.5,9,false,INK));
    doc.text(String(it.qty),cx[1]+COLS[1][1]-5,y+15,9.2,true,INK,'r');
    doc.text(num(it.price),cx[2]+COLS[2][1]-5,y+15,8.8,false,INK,'r');
    doc.text(num(it.qty*it.price),cx[3]+COLS[3][1]-5,y+15,8.8,false,INK,'r');
    doc.line(M,y+rh,M+CW,y+rh,LINE,0.6);y+=rh;
  });
  if(r.note){const nl=wrap('Note: '+r.note,8.6,false,CW-20);if(y+nl.length*11+10>FOOT-4){small();y=56}
    nl.forEach((t,j)=>doc.text(t,M+5,y+14+j*11,8.6,false,MUT));y+=nl.length*11+8}
  const nPay=r.payments.length;
  if(y+130+nPay*15>FOOT){small();y=56}
  y+=14;const t1=PW-M-215,t2=PW-M-6,row=(a,b,bold,col)=>{doc.text(a,t1,y,9.5,!!bold,col||MUT);doc.text(b,t2,y,9.5,!!bold,col||INK,'r');y+=15};
  if(r.disc>0||r.tax>0)row('Subtotal',money(r.sub));
  if(r.disc>0)row('Discount','- '+money(r.disc));
  if(r.tax>0)row('Less: '+r.taxLabel,'- '+money(r.tax));
  doc.line(t1,y-8,PW-M,y-8,INK,1);y+=8;
  doc.text('TOTAL',t1,y,11,true,INK);doc.text(money(r.total),t2,y,13,true,INK,'r');y+=24;
  if(nPay){doc.text('PAYMENTS RECEIVED',M,y,8,true,PINK);y+=4;
    r.payments.forEach(p=>{y+=14;doc.text(p.date+'  -  '+p.method+(p.bank?' ('+p.bank+')':''),M,y,9.5,false,INK);doc.text(money(p.amt),PW-M-6,y,9.5,false,INK,'r');doc.line(M,y+5,PW-M,y+5,LINE,0.6)});
    y+=8}
  y+=14;
  if(r.bal>0){doc.rect(M,y,CW,36,PINKBG,PINKBD,1);doc.rect(M,y,5,36,PINK);doc.text('BALANCE DUE',M+18,y+22,10,true,PINK);doc.text(money(r.bal),PW-M-14,y+24,15,true,INK,'r');y+=36}
  else{doc.rect(M,y,CW,36,PINKBG,PINKBD,1);doc.rect(M,y,5,36,PINK);doc.text('PAID IN FULL',M+18,y+22,10,true,PINK);doc.text('Thank you!',PW-M-14,y+22,11,true,INK,'r');y+=36}
  if(r.status)doc.text('Order status: '+r.status,M,y+16,8.6,false,MUT);
  if(biz.footer)doc.text(biz.footer,PW/2,y+44,9.5,true,MUT,'c');
  const n=doc.pages.length;
  for(let p=0;p<n;p++){doc.at(p);doc.line(M,PH-34,PW-M,PH-34,LINE,0.6);
    doc.text(store+'  -  Receipt '+r.no,M,PH-21,7.8,false,MUT);
    doc.text('Page '+(p+1)+' of '+n,PW-M,PH-21,7.8,false,MUT,'r')}
  return build(doc,'Receipt '+r.no+' - '+r.name,logo);
};

window.makeQuotePdf=function(o){
  const biz=o.biz||{},cur=(biz.cur&&biz.cur!=='₱')?asc(biz.cur):'PHP',money=n=>cur+' '+num(n),store=asc(biz.name||''),r=o.quote;
  let logo=null;
  if(window.LOGO_DATA){try{const bin=atob(window.LOGO_DATA.b64),b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);logo={w:window.LOGO_DATA.w,h:window.LOGO_DATA.h,bytes:b}}catch(e){logo=null}}
  const doc=new Doc(),FOOT=PH-44;
  doc.page();
  doc.rect(0,0,PW,96,'#000000');
  if(logo){const h=62,w=h*logo.w/logo.h;doc.image(M,17,w,h)}else doc.text(store,M,56,20,true,'#ffffff');
  doc.text('QUOTATION',PW-M,48,19,true,'#ffffff','r');
  doc.text('Date: '+o.date,PW-M,67,9.5,false,LT,'r');
  if(o.valid)doc.text('Valid until: '+o.valid,PW-M,83,10.5,true,'#ffffff','r');
  doc.rect(0,96,PW,4,PINK2);
  let y=126;
  doc.text('PREPARED FOR',M,y,8,true,PINK);doc.text('FROM',320,y,8,true,PINK);
  let ly=y+16;
  wrap(r.name||'Customer',13,true,250).forEach(t=>{doc.text(t,M,ly,13,true,INK);ly+=16});
  if(r.phone){doc.text(r.phone,M,ly,9.5,false,INK);ly+=13}
  if(r.address)wrap(r.address,9.5,false,250).forEach(t=>{doc.text(t,M,ly,9.5,false,MUT);ly+=13});
  let ry=y+16;
  wrap(store,11,true,235).forEach(t=>{doc.text(t,320,ry,11,true,INK);ry+=14});
  if(biz.addr)wrap(biz.addr,9.5,false,235).forEach(t=>{doc.text(t,320,ry,9.5,false,MUT);ry+=13});
  if(biz.phone){doc.text(biz.phone,320,ry,9.5,false,INK);ry+=13}
  y=Math.max(ly,ry)+20;
  const COLS=[['Description',0,'l'],['Qty',44,'r'],['Unit price',74,'r'],['Amount',80,'r']];
  COLS[0][1]=CW-COLS.reduce((a,c)=>a+c[1],0);
  const cx=[];{let x=M;COLS.forEach(c=>{cx.push(x);x+=c[1]})}
  const head=yy=>{doc.rect(M,yy,CW,19,'#000000');COLS.forEach((c,i)=>doc.text(c[0],c[2]==='r'?cx[i]+c[1]-5:cx[i]+5,yy+12.6,8.2,true,'#ffffff',c[2]));return yy+19};
  const small=()=>{doc.page();doc.rect(0,0,PW,34,'#000000');doc.rect(0,34,PW,3,PINK2);doc.text(store,M,22,11,true,'#ffffff');doc.text('Quotation for '+r.name+' (continued)',PW-M,22,9,false,LT,'r')};
  y=head(y);
  r.items.forEach(it=>{
    const dl=wrap(it.name,9,false,COLS[0][1]-10),rh=Math.max(dl.length*11.5+10,24);
    if(y+rh>FOOT-4){small();y=head(52)}
    dl.forEach((t,j)=>doc.text(t,cx[0]+5,y+15+j*11.5,9,false,INK));
    doc.text(String(it.qty),cx[1]+COLS[1][1]-5,y+15,9.2,true,INK,'r');
    doc.text(num(it.price),cx[2]+COLS[2][1]-5,y+15,8.8,false,INK,'r');
    doc.text(num(it.qty*it.price),cx[3]+COLS[3][1]-5,y+15,8.8,false,INK,'r');
    doc.line(M,y+rh,M+CW,y+rh,LINE,0.6);y+=rh;
  });
  if(y+110>FOOT){small();y=56}
  y+=14;const t1=PW-M-215,t2=PW-M-6,row=(a,b)=>{doc.text(a,t1,y,9.5,false,MUT);doc.text(b,t2,y,9.5,false,INK,'r');y+=15};
  if(r.disc>0||r.tax>0)row('Subtotal',money(r.sub));
  if(r.disc>0)row('Discount','- '+money(r.disc));
  if(r.tax>0)row('Less: '+r.taxLabel,'- '+money(r.tax));
  doc.line(t1,y-8,PW-M,y-8,INK,1);y+=8;
  doc.text('TOTAL',t1,y,11,true,PINK);doc.text(money(r.total),t2,y,14,true,PINK,'r');y+=26;
  const nl=r.note?String(r.note).split(/\r?\n/).flatMap(l=>wrap(l,9.2,false,CW-24)):[];
  if(nl.length){
    const bh=nl.length*12.5+30;
    if(y+bh>FOOT){small();y=56}
    doc.rect(M,y,CW,bh,'#ffffff',LINE,1);
    doc.text('NOTES & TERMS',M+12,y+17,8.5,true,PINK);
    nl.forEach((t,k)=>doc.text(t,M+12,y+32+k*12.5,9.2,false,INK));
    y+=bh+16;
  }
  if(y+100>FOOT){small();y=56}
  doc.text('To approve this quotation, please sign below and send back a copy.',M,y+8,9.5,false,INK);
  y+=52;
  const sw=(CW-40)/2;
  [['Approved by (name & signature)',M],['Date',M+sw+40]].forEach(([l,x])=>{doc.line(x,y,x+sw,y,INK,0.8);doc.text(l,x,y+12,8.2,false,MUT)});
  y+=36;
  if(biz.footer)doc.text(biz.footer,PW/2,y+4,9.5,true,MUT,'c');
  const n=doc.pages.length;
  for(let p=0;p<n;p++){doc.at(p);doc.line(M,PH-34,PW-M,PH-34,LINE,0.6);
    doc.text(store+'  -  Quotation for '+asc(r.name),M,PH-21,7.8,false,MUT);
    doc.text('Page '+(p+1)+' of '+n,PW-M,PH-21,7.8,false,MUT,'r')}
  return build(doc,'Quotation - '+r.name,logo);
};
})();
