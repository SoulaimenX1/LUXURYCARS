import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {buildApiUrl} from '@/lib/api';
type Ctx={params:Promise<{damageId:string}>};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function proxy(req:Request,ctx:Ctx,method:'GET'|'POST'){
 const {damageId}=await ctx.params;
 if(!UUID.test(damageId))return NextResponse.json({message:'Invalid damage identifier'},{status:400});
 const token=(await cookies()).get('access_token')?.value;
 if(!token)return NextResponse.json({message:'Authentication required'},{status:401});
 if(method==='POST'){
  const origin=req.headers.get('origin');
  if(origin){try{if(new URL(origin).host!==new URL(req.url).host)return NextResponse.json({message:'Invalid origin'},{status:403});}
   catch{return NextResponse.json({message:'Invalid origin'},{status:403});}}
 }
 try{
  let body:FormData|undefined;
  if(method==='POST'){
   const data=await req.formData();const photo=data.get('photo');
   if(!(photo instanceof File)||photo.size>5*1024*1024||photo.size<=0)return NextResponse.json({message:'Only images up to 5MB accepted'},{status:400});
   body=new FormData();body.set('photo',photo);
  }
  const res=await fetch(buildApiUrl(`/returns/admin/damages/${damageId}/photo`),{
   method,headers:{Authorization:`Bearer ${token}`},body,cache:'no-store'});
  if(method==='GET'&&res.ok)return new NextResponse(await res.arrayBuffer(),{
   headers:{'Content-Type':res.headers.get('Content-Type')??'application/octet-stream','Cache-Control':'private, no-store'}
  });
  try{return NextResponse.json(await res.json(),{status:res.status});}
  catch{return NextResponse.json({message:'Inspection photo unavailable'},{status:502});}
 }catch{return NextResponse.json({message:'Inspection photo service unavailable'},{status:502});}
}
export function GET(req:Request,ctx:Ctx){return proxy(req,ctx,'GET');}
export function POST(req:Request,ctx:Ctx){return proxy(req,ctx,'POST');}
