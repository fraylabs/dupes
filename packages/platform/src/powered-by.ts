// Hosted-only footer. Self-hosted apps retain their existing presentation.
export const poweredByCSS=`.dupes-powered-by{box-sizing:border-box;display:flex;justify-content:center;align-items:center;padding:18px 20px;background:#faf9f6;border-top:1px solid #e8e7e3;font:12px/1.6 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#777c82}.dupes-powered-by a{color:inherit;text-decoration:none;border-radius:4px}.dupes-powered-by a:hover{color:#af573f;text-decoration:underline}.dupes-powered-by a:focus-visible{outline:2px solid #af573f;outline-offset:5px}.respondent-footer{display:none}`;
export function badgeLink(instanceId:string) {
  const url=new URL('https://dupes.sh/');url.searchParams.set('utm_source','badge');url.searchParams.set('utm_medium','board');url.searchParams.set('utm_content',instanceId);return url.href;
}
export async function withPoweredBy(response:Response,instance:{id:string;app:string;powered_by?:number},path:string,base:string) {
  const publicPage=instance.app==='forms'?/^\/f\/[^/]+(?:\/embed)?\/?$/.test(path):!/^\/admin(?:\/|$)/.test(path);
  if(instance.powered_by===0||!publicPage||response.status!==200||!response.headers.get('Content-Type')?.includes('text/html'))return response;
  const href=badgeLink(instance.id).replaceAll('&','&amp;');
  const html=(await response.text()).replace('</head>','<link rel="stylesheet" href="'+base+'/assets/powered-by.css"></head>').replace('</body>','<footer class="dupes-powered-by"><a href="'+href+'" target="_blank" rel="noopener">Powered by Dupes</a></footer></body>');
  const headers=new Headers(response.headers);headers.delete('Content-Length');return new Response(html,{status:response.status,headers});
}
