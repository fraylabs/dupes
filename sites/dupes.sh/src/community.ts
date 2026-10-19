export const community = [
  ['ArtCraft','artcraft','AI image and video studio'],
  ['PhotoCraft','photocraft','Image editing'],
  ['FilmCraft','filmcraft','Video editing, colour and sound'],
  ['FigCraft','figcraft','Interface design and prototyping'],
  ['VectorCraft','vectorcraft','Vector illustration'],
  ['LightCraft','lightcraft','Photo library and raw development'],
  ['PdfCraft','pdfcraft','PDF reading and organisation'],
  ['EffectCraft','effectcraft','Motion graphics and visual effects'],
  ['DesignCraft','designcraft','Page layout and publishing']
] as const;

export const communityProjects = [
  ...community.map(([name,repo,description])=>({name,description,credit:'ArtCraft team & contributors',repository:`https://github.com/storytold/${repo}`,licence:'MIT OR Apache-2.0',licenceUrl:`https://github.com/storytold/${repo}/blob/main/LICENSE-APACHE`})),
  {name:'Macro',description:'An open-source workspace bringing email, chat, docs, tasks, CRM and agents together to replace many separate apps.',credit:'Macro team & contributors',repository:'https://github.com/macro-inc/macro',licence:'AGPL-3.0',licenceUrl:'https://github.com/macro-inc/macro/blob/d57b6a63569618ccd2fba3e35813f3134021f864/LICENSE.txt'}
];
