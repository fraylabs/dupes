// iPhone Safari won't play a video unless Range requests get 206; static assets answer them with the whole file.
export async function video(request:Request,assets:{fetch(request:Request):Promise<Response>}):Promise<Response>{
  const range=request.headers.get('range');
  const asset=await assets.fetch(new Request(request.url,{method:request.method,headers:{accept:request.headers.get('accept')??'*/*'}}));
  const headers=new Headers(asset.headers);headers.set('Accept-Ranges','bytes');
  const m=range&&request.method==='GET'&&asset.status===200?/^bytes=(\d*)-(\d*)$/.exec(range.trim()):null;
  if(!m||(m[1]===''&&m[2]===''))return new Response(asset.body,{status:asset.status,headers});
  const body=await asset.arrayBuffer(),size=body.byteLength;
  let start:number,end:number;
  if(m[1]===''){start=Math.max(0,size-Number(m[2]));end=size-1;}
  else{start=Number(m[1]);end=m[2]===''?size-1:Math.min(Number(m[2]),size-1);}
  if(start>=size||start>end){headers.delete('Content-Length');headers.set('Content-Range',`bytes */${size}`);return new Response(null,{status:416,headers});}
  headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Content-Length',String(end-start+1));
  return new Response(body.slice(start,end+1),{status:206,headers});
}
