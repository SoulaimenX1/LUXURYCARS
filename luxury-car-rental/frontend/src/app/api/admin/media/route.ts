import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {buildApiUrl} from '@/lib/api';

// Upload authentifié : galerie secondaire ou modèle GLB, via le serveur Next.js.
const PLATE=/^[A-Za-z0-9 _-]{2,25}$/;
export async function POST(req:Request){
 const origin=req.headers.get('origin');
 if(origin){try{if(new URL(origin).origin!==new URL(req.url).origin)return NextResponse.json({message:'Origin rejected'},{status:403});}
 catch{return NextResponse.json({message:'Invalid origin'},{status:403});}}
 const token=(await cookies()).get('access_token')?.value;
 if(!token)return NextResponse.json({message:'Authentication required'},{status:401});
 try{
  const form=await req.formData();
  const plate=form.get('licensePlate');const kind=form.get('kind');const file=form.get('file');
  if(typeof plate!=='string'||!PLATE.test(plate) ||
      (kind!=='image' && kind!=='video' && kind!=='model3d') || !(file instanceof File))
    return NextResponse.json({message:'Invalid media upload'},{status:400});
  const max=kind==='image'?8*1024*1024:kind==='video'?300*1024*1024:40*1024*1024;
  if(file.size<1||file.size>max)return NextResponse.json({message:'Invalid file size'},{status:413});
  if(kind==='image'&&!['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(file.type))return NextResponse.json({message:'Unsupported image format'},{status:400});
  if(kind==='video'&&!['video/mp4','video/webm','video/ogg','video/quicktime'].includes(file.type))return NextResponse.json({message:'Unsupported video format'},{status:400});
  if(kind==='model3d'&&!file.name.toLowerCase().endsWith('.glb'))return NextResponse.json({message:'Please select a .glb file'},{status:400});
  const payload=new FormData();payload.append(kind==='model3d'?'model':'file',file);
  const endpoint=kind==='model3d'?`/vehicles/by-plate/${encodeURIComponent(plate)}/model3d`:
    `/vehicles/by-plate/${encodeURIComponent(plate)}/gallery/${kind}`;
  const result=await fetch(buildApiUrl(endpoint),{method:'POST',headers:{Authorization:`Bearer ${token}`},body:payload,cache:'no-store'});
  const body=await result.json();return NextResponse.json(body,{status:result.status});
 }catch{return NextResponse.json({message:'Media upload failed'},{status:502});}
}
