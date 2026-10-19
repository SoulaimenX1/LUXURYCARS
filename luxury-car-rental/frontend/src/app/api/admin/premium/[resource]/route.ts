import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildApiUrl } from '@/lib/api';
type Context={params:Promise<{resource:string}>};

const RESOURCES = ['extras','promotions','locations'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROMO_CODE = /^[A-Z0-9_-]{3,30}$/;

export async function POST(req:Request,context:Context){
 const {resource}=await context.params;
 if(resource!=='extras'&&resource!=='promotions'&&resource!=='locations') return NextResponse.json({message:'Not found'},{status:404});
 const origin=req.headers.get('origin');
 if(origin){try{if(new URL(origin).host!==new URL(req.url).host) return NextResponse.json({message:'Origin rejected'},{status:403});}
 catch{return NextResponse.json({message:'Invalid origin'},{status:403});}}
 const token=(await cookies()).get('access_token')?.value;
 if(!token) return NextResponse.json({message:'Authentication required'},{status:401});
 try{
  if(!req.headers.get('content-type')?.includes('application/json')) return NextResponse.json({message:'JSON required'},{status:415});
  const text=await req.text();if(text.length>5000) return NextResponse.json({message:'Too large'},{status:413});
  JSON.parse(text);
  const r=await fetch(buildApiUrl(`/premium/admin/${resource}`),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:text,cache:'no-store'});
  return NextResponse.json(await r.json(),{status:r.status});
 }catch{return NextResponse.json({message:'Premium admin service unavailable'},{status:502});}
}

// Liste complète d'une ressource, y compris les entrées désactivées.
export async function GET(_req:Request,context:Context){
 const {resource}=await context.params;
 if(!RESOURCES.includes(resource as (typeof RESOURCES)[number])) return NextResponse.json({message:'Not found'},{status:404});
 const token=(await cookies()).get('access_token')?.value;
 if(!token)return NextResponse.json({message:'Authentication required'},{status:401});
 try{
  const r=await fetch(buildApiUrl(`/premium/admin/${resource}`),{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
  return NextResponse.json(await r.json(),{status:r.status});
 }catch{return NextResponse.json({message:'Premium admin service unavailable'},{status:502});}
}

// Supprimer un extra (par identifiant), une promotion (par code) ou un lieu (par identifiant).
export async function DELETE(req:Request,context:Context){
 const {resource}=await context.params;
 if(resource!=='extras'&&resource!=='promotions'&&resource!=='locations') return NextResponse.json({message:'Not found'},{status:404});
 const origin=req.headers.get('origin');
 if(origin){try{if(new URL(origin).host!==new URL(req.url).host) return NextResponse.json({message:'Origin rejected'},{status:403});}
 catch{return NextResponse.json({message:'Invalid origin'},{status:403});}}
 const token=(await cookies()).get('access_token')?.value;
 if(!token) return NextResponse.json({message:'Authentication required'},{status:401});
 const id=(new URL(req.url).searchParams.get('id')??'').trim();
 if(resource==='extras'&&!UUID.test(id)) return NextResponse.json({message:'Invalid extra identifier'},{status:400});
 if(resource==='locations'&&!UUID.test(id)) return NextResponse.json({message:'Invalid location identifier'},{status:400});
 if(resource==='promotions'&&!PROMO_CODE.test(id.toUpperCase())) return NextResponse.json({message:'Invalid promotion code'},{status:400});
 try{
  const path=resource==='extras'?`/premium/admin/extras/${id}`
   :resource==='locations'?`/premium/admin/locations/${id}`
   :`/premium/admin/promotions/${encodeURIComponent(id.toUpperCase())}`;
  const r=await fetch(buildApiUrl(path),{method:'DELETE',headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
  const text=await r.text();
  if(!text) return new NextResponse(null,{status:r.status});
  try{return NextResponse.json(JSON.parse(text) as unknown,{status:r.status});}
  catch{return NextResponse.json({message:'Invalid backend response'},{status:502});}
 }catch{return NextResponse.json({message:'Premium admin service unavailable'},{status:502});}
}
