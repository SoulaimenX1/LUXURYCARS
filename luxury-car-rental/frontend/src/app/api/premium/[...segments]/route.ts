import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';

// Proxy avec liste blanche : jamais d'URL choisie librement par le navigateur.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^RES-[A-Z0-9-]{5,30}$/i;
type Ctx = { params: Promise<{segments:string[]}> };
function allowed(parts:string[],method:string) {
  const route=parts.join('/');
  if (method==='GET') return route==='options'||route==='locations'||route==='me/favorites'||route==='me/loyalty'||route==='me/reviewable'||(parts[0]==='reviews'&&parts.length===2&&UUID.test(parts[1]))||(parts[0]==='editorial-reviews'&&parts.length===2&&UUID.test(parts[1]));
  if (method==='POST') return route==='quote'||route==='me/reviews'||(parts.length===3&&parts[0]==='me'&&parts[1]==='favorites'&&UUID.test(parts[2]))||(parts.length===3&&parts[0]==='me'&&parts[1]==='checkin'&&CODE.test(parts[2]));
  return false;
}
async function proxy(request:Request, ctx:Ctx, method:'GET'|'POST') {
  const {segments}=await ctx.params;
  if(!allowed(segments,method)) return NextResponse.json({message:'Not found'}, {status:404});
  if(method==='POST') {
    const origin=request.headers.get('origin');
    if(origin) { try {if(new URL(origin).host!==new URL(request.url).host) return NextResponse.json({message:'Origin rejected'}, {status:403});} catch{return NextResponse.json({message:'Invalid origin'}, {status:403});} }
  }
  const path=segments.join('/');
  const publicRoute=path==='options'||path==='locations'||path==='quote'||path.startsWith('reviews/')||path.startsWith('editorial-reviews/');
  const token=(await cookies()).get('access_token')?.value;
  if(!publicRoute&&!token) return NextResponse.json({message:'Authentication required'}, {status:401});
  try {
    let body:string|undefined;
    if(method==='POST') {
      if(!request.headers.get('content-type')?.includes('application/json')) return NextResponse.json({message:'JSON required'}, {status:415});
      body=await request.text();
      if(body.length>6000) return NextResponse.json({message:'Request too large'}, {status:413});
      try { JSON.parse(body); }
      catch { return NextResponse.json({message:'Invalid JSON'}, {status:400}); }
    }
    const r=await fetch(buildApiUrl(`/premium/${path}`),{
      method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(method==='POST'?{'Content-Type':'application/json'}:{})},
      body,cache:'no-store'
    });
    const payload=await r.text();
    try {return NextResponse.json(JSON.parse(payload),{status:r.status,headers:{'Cache-Control':'no-store'}});}
    catch {return NextResponse.json({message:'Invalid upstream response'}, {status:502});}
  } catch{return NextResponse.json({message:'Premium service unavailable'}, {status:502});}
}
export function GET(request:Request, ctx:Ctx){return proxy(request,ctx,'GET');}
export function POST(request:Request, ctx:Ctx){return proxy(request,ctx,'POST');}
