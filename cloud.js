// Online sync + login for On&iT POS (Supabase Auth + Postgres).
// Loaded only when app-config.js has been filled in.
const SOURCES=[
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
  'https://esm.sh/@supabase/supabase-js@2'
];
async function loadClient(){
  let last;
  for(const u of SOURCES){
    try{const m=await import(u);if(m&&m.createClient)return m.createClient}catch(e){last=e}
  }
  throw new Error('The Supabase library could not be downloaded. Check your internet, and turn off any ad blocker or school/work filter for this site.'+(last&&last.message?' ('+last.message+')':''));
}
function fail(msg){window.CloudError=msg;window.dispatchEvent(new Event('cloud-failed'))}

const cfg=window.TRIPOS_CLOUD||{};
let url=String(cfg.supabase&&cfg.supabase.url||'').trim().replace(/^["'\s]+|["',\s]+$/g,'');
if(url&&!/^https?:\/\//i.test(url))url='https://'+url;
try{if(url)url=new URL(url).origin}catch(e){}   // drops extra paths like /rest/v1
const key=String(cfg.supabase&&cfg.supabase.anonKey||'').trim();
let sb=null;
if(!/^https:\/\/[^\s/]+\.[^\s/]+$/.test(url)||/supabase\.com/i.test(url)){
  fail('The Supabase URL in app-config.js looks wrong. It should look like https://abcdefgh.supabase.co (the Project URL, not the dashboard address).');
}else{
  try{
    const createClient=await loadClient();
    sb=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}});
  }catch(e){fail(e.message)}
}
const COLS=['items','contacts','orders','expenses','quotes'];
const ALL=[...COLS,'settings','meta'];
const single=c=>c==='settings'||c==='meta';

function authError(error){
  const m=String(error&&error.message||''),e=new Error(m);
  e.code=/invalid login|invalid credentials/i.test(m)?'auth/invalid-credential':/failed to fetch|network/i.test(m)?'auth/network-request-failed':/rate limit|too many/i.test(m)?'auth/too-many-requests':m;
  return e;
}

if(sb){window.Cloud={
  colls:COLS,
  // Calls cb({email}) or cb(null) only when the signed-in person changes.
  onUser(cb){
    let last=null,seen=false;
    const {data}=sb.auth.onAuthStateChange((evt,session)=>{
      const em=session&&session.user&&session.user.email?session.user.email:null;
      if(seen&&em===last)return;
      seen=true;last=em;
      setTimeout(()=>cb(em?{email:em}:null),0);
    });
    return()=>data.subscription.unsubscribe();
  },
  async login(email,pw){
    const {error}=await sb.auth.signInWithPassword({email,password:pw});
    if(error)throw authError(error);
  },
  async logout(){await sb.auth.signOut()},

  // Loads everything this person is allowed to see, then keeps it live.
  // Database rules (supabase-setup.sql) decide what each role receives.
  listen(role,h){
    let stopped=false,subscribed=false,loading=false;
    const cache={};ALL.forEach(c=>cache[c]=new Map());
    const val=(r)=>single(r.coll)?r.data:{...r.data,id:r.id};
    const push=c=>{
      if(stopped)return;
      if(c==='settings')h.settings(cache.settings.get('main')||null,false);
      else if(c==='meta'){const r=cache.meta.get('counter');h.counter(r&&r.n?r.n:1)}
      else h.coll(c,[...cache[c].values()],false);
    };
    async function load(){
      if(loading||stopped)return;
      loading=true;
      try{
        const rows=[];
        for(let from=0;;from+=1000){
          const {data,error}=await sb.from('docs').select('coll,id,data').order('coll').order('id').range(from,from+999);
          if(error)throw error;
          rows.push(...data);
          if(data.length<1000)break;
        }
        ALL.forEach(c=>cache[c].clear());
        rows.forEach(r=>{if(cache[r.coll])cache[r.coll].set(r.id,val(r))});
        (role==='owner'?COLS:COLS.filter(c=>c!=='expenses'&&c!=='quotes')).forEach(push);
        push('meta');push('settings');
      }catch(e){if(!stopped)h.error(e)}
      finally{loading=false}
    }
    const ch=sb.channel('docs-'+Math.random().toString(36).slice(2))
      .on('postgres_changes',{event:'*',schema:'public',table:'docs'},p=>{
        const row=p.eventType==='DELETE'?p.old:p.new;
        if(!row||!cache[row.coll])return;
        if(role!=='owner'&&(row.coll==='expenses'||row.coll==='quotes'))return;
        if(p.eventType==='DELETE')cache[row.coll].delete(row.id);
        else cache[row.coll].set(row.id,val(row));
        push(row.coll);
      })
      .subscribe(st=>{subscribed=st==='SUBSCRIBED';if(subscribed)load()});
    load();
    // Safety net if live updates are not connected.
    const poll=setInterval(()=>{if(!subscribed)load()},15000);
    return()=>{stopped=true;clearInterval(poll);sb.removeChannel(ch)};
  },

  async write(c,o){
    const {error}=await sb.from('docs').upsert({coll:c,id:o.id,data:o,updated_at:new Date().toISOString()});
    if(error)throw error;
  },
  async remove(c,id){
    const {error}=await sb.from('docs').delete().eq('coll',c).eq('id',id);
    if(error)throw error;
  },
  async writeSettings(o){
    const {error}=await sb.from('docs').upsert({coll:'settings',id:'main',data:o,updated_at:new Date().toISOString()});
    if(error)throw error;
  },
  async setCounter(n){
    const {error}=await sb.from('docs').upsert({coll:'meta',id:'counter',data:{n},updated_at:new Date().toISOString()});
    if(error)throw error;
  },
  // Both phones draw order numbers from one counter so numbers never repeat.
  async nextOrderNo(){
    const {data,error}=await sb.rpc('next_order_no');
    if(error)throw error;
    return data;
  }
};
window.dispatchEvent(new Event('cloud-ready'));}
