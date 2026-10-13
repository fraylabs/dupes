import { z } from 'zod';
import type { Feedback } from './service.ts';
export const mcpTools=[
  {name:'list_posts',description:'List or search feedback posts, including private boards. Highest votes first.',inputSchema:{type:'object',properties:{board:{type:'string'},q:{type:'string'},status:{type:'string'},limit:{type:'integer',minimum:1,maximum:200}},additionalProperties:false}},
  {name:'search_posts',description:'Search feedback titles and details.',inputSchema:{type:'object',properties:{q:{type:'string'},limit:{type:'integer',minimum:1,maximum:200}},required:['q'],additionalProperties:false}},
  {name:'top_requests',description:'Read the most requested ideas.',inputSchema:{type:'object',properties:{board:{type:'string'},limit:{type:'integer',minimum:1,maximum:200}},additionalProperties:false}},
  {name:'update_status',description:'Update a post after reviewing or shipping the request.',inputSchema:{type:'object',properties:{postId:{type:'string'},status:{type:'string',enum:['open','under review','planned','in progress','complete','closed']}},required:['postId','status'],additionalProperties:false}},
  {name:'post_changelog',description:'Publish a changelog linked to shipped feedback posts.',inputSchema:{type:'object',properties:{title:{type:'string'},body:{type:'string'},postIds:{type:'array',items:{type:'string'}},type:{type:'string',enum:['new','improved','fixed']}},required:['title','body'],additionalProperties:false}}
];
export async function rpc(service:Feedback,body:any) {
  const requestId=body?.id;
  const response=(result:unknown)=>({jsonrpc:'2.0',id:requestId,result});
  const error=(code:number,message:string)=>({jsonrpc:'2.0',id:requestId??null,error:{code,message}});
  if(body?.jsonrpc!=='2.0'||typeof body.method!=='string')return error(-32600,'Invalid request');
  if(requestId===undefined)return null;
  if(body.method==='initialize')return response({protocolVersion:['2025-03-26','2025-06-18'].includes(body.params?.protocolVersion)?body.params.protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},serverInfo:{name:'dupes-feedback',version:'0.1.0'},instructions:'Use an API key. Read feedback, implement requests, then update status and publish a changelog.'});
  if(body.method==='ping')return response({});
  if(body.method==='tools/list')return response({tools:mcpTools});
  if(body.method!=='tools/call')return error(-32601,'Method not found');
  try {
    const a=body.params?.arguments||{};let result;
    const filters=z.object({q:z.string().max(200).optional(),board:z.string().optional(),status:z.string().optional(),limit:z.number().int().min(1).max(200).optional()});
    switch(body.params?.name) {
      case 'list_posts':case 'top_requests':result=await service.posts(filters.parse(a),true);break;
      case 'search_posts':z.object({q:z.string().min(1)}).parse(a);result=await service.posts(filters.parse(a),true);break;
      case 'update_status':{const input=z.object({postId:z.string(),status:z.string()}).parse(a);result=await service.updateStatus(input.postId,input.status);break;}
      case 'post_changelog':result=await service.createEntry(a);break;
      default:return error(-32602,'Unknown tool');
    }
    return response({content:[{type:'text',text:JSON.stringify(result)}]});
  } catch(e) {return response({isError:true,content:[{type:'text',text:e instanceof z.ZodError?'Invalid tool arguments':e instanceof Error?e.message:'Tool failed'}]});}
}
