import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {buildApiUrl} from '@/lib/api';
type Context={params:Promise<{segments:string[]}>};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function target(parts:string[],method:'GET'|'POST'|'PUT'):{url:string;pdf:boolean}|null{
 if(parts[0]==='returns'){
  if(parts.length===2&&UUID.test(parts[1])&&method==='GET') return {url:`/returns/admin/${parts[1]}/damages`,pdf:false};
  if(parts.length===2&&parts[1]==='policy'&&(method==='GET'||method==='PUT')) return {url:'/returns/admin/policy',pdf:false};
  if(parts.length===3&&UUID.test(parts[1])&&method==='POST'&&['return','close'].includes(parts[2])) return {url:`/returns/admin/${parts[1]}/${parts[2]}`,pdf:false};
 }
 if(parts[0]==='finance'&&parts.length>=2&&UUID.test(parts[1])){
  const prefix=`/finance/admin/${parts[1]}`;
  if(parts.length===2&&method==='GET') return {url:prefix,pdf:false};
  const suffix=parts.slice(2).join('/');
  if(method==='POST'&&['payments','deposit/hold','deposit/settle','invoice','charges'].includes(suffix)) return {url:`${prefix}/${suffix}`,pdf:false};
  if(method==='GET'&&['documents/contract','documents/invoice'].includes(suffix)) return {url:`${prefix}/${suffix}`,pdf:true};
 }
 return null;
}
async function proxy(req:Request,ctx:Context,method:'GET'|'POST'|'PUT'){
 const {segments}=await ctx.params;
 const action=target(segments,method);
 if(!action) return NextResponse.json({message:'Not found'}, {status:404});
 const token=(await cookies()).get('access_token')?.value;
 if(!token) return NextResponse.json({message:'Authentication required'}, {status:401});
 if(method!=='GET'){
  const origin=req.headers.get('origin');
  if(origin){try{if(new URL(origin).host!==new URL(req.url).host)return NextResponse.json({message:'Invalid origin'},{status:403});}catch{return NextResponse.json({message:'Invalid origin'},{status:403});}}
 }
 try{
  let body: string|undefined;
  if(method!=='GET'){
   if(!req.headers.get('content-type')?.includes('application/json'))return NextResponse.json({message:'JSON required'},{status:415});
   body=await req.text();if(body.length>7000)return NextResponse.json({message:'Request too large'},{status:413});
   try { JSON.parse(body); }
   catch { return NextResponse.json({message:'Invalid JSON'}, {status:400}); }
  }
  const response=await fetch(buildApiUrl(action.url),{method,
   headers:{Authorization:`Bearer ${token}`,...(method!=='GET'?{'Content-Type':'application/json'}:{})},
   body,cache:'no-store'});
  if(action.pdf&&response.ok){
   return new NextResponse(await response.arrayBuffer(),{
    status:response.status,headers:{'Content-Type':'application/pdf','Content-Disposition':response.headers.get('Content-Disposition')??'attachment; filename="document.pdf"','Cache-Control':'no-store'}
   });
  }
  const text=await response.text();
  try{return NextResponse.json(JSON.parse(text),{status:response.status});}
  catch{return NextResponse.json({message:'Invalid response'}, {status:502});}
 }catch{return NextResponse.json({message:'Rental operations unavailable'},{status:502});}
}
export function GET(req:Request,ctx:Context){return proxy(req,ctx,'GET');}
export function POST(req:Request,ctx:Context){return proxy(req,ctx,'POST');}
export function PUT(req:Request,ctx:Context){return proxy(req,ctx,'PUT');}
