import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {buildApiUrl} from '@/lib/api';

// ==========================================================
// /api/admin/media/:mediaId
// ==========================================================
//
// DELETE : supprime UNE SEULE photo (ou vidéo) de la
// galerie d'un véhicule depuis le studio média.
//
// Le JWT reste dans le cookie HttpOnly côté serveur.

type Context={params:Promise<{mediaId:string}>};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(req:Request,context:Context){
 const {mediaId}=await context.params;
 if(!UUID.test(mediaId))return NextResponse.json({message:'Invalid media identifier'},{status:400});

 // Protection cross-site pour toute requête qui modifie les données.
 const origin=req.headers.get('origin');
 if(origin){try{if(new URL(origin).origin!==new URL(req.url).origin)return NextResponse.json({message:'Origin rejected'},{status:403});}
  catch{return NextResponse.json({message:'Invalid origin'},{status:403});}}

 const token=(await cookies()).get('access_token')?.value;
 if(!token)return NextResponse.json({message:'Authentication required'},{status:401});

 try{
  const result=await fetch(buildApiUrl(`/vehicles/media/${encodeURIComponent(mediaId)}`),{
   method:'DELETE',headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
  const text=await result.text();
  if(!text)return new NextResponse(null,{status:result.status});
  try{
   return NextResponse.json(JSON.parse(text) as unknown,{
    status:result.status,headers:{'Cache-Control':'no-store'}});
  }catch{
   return NextResponse.json({message:'Invalid response from vehicle service.'},{status:502});
  }
 }catch{return NextResponse.json({message:'Unable to delete vehicle media.'},{status:502});}
}
