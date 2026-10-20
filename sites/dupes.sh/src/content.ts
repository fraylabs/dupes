// Alternative/comparison pages and problem-led posts. Competitor facts come only from their public pages (source + checked date).
// Each source carries its own checked date; change only the one you re-checked.
const CHECKED_ON:Record<string,string>={'https://canny.io/pricing':'2026-10-20','https://fider.io/pricing':'2026-10-20','https://upvoty.com/pricing':'2026-10-20','https://featurebase.app/pricing':'2026-10-20','https://frill.co/pricing':'2026-10-20'};
type Entry={path:string;title:string;description:string;names:string[];date?:string;body:string};
const src=(href:string,label:string)=>`<a href="${href}" rel="nofollow noopener">${label}</a>`;
const cta=`<p><a class="button" href="/vote">Try the live voting board<span aria-hidden="true"> ↗</span></a> <a class="button secondary" href="/i/next-dupe/?board=candidates">Open the live board<span aria-hidden="true"> ↗</span></a> <a class="button secondary" href="/waitlist?utm_source=content">Join the hosted waitlist<span aria-hidden="true"> ↗</span></a></p>`;
const head=(eyebrow:string,h1:string,lead:string)=>`<section class="page-head compact"><p class="eyebrow">${eyebrow}</p><h1>${h1}</h1><p class="lead">${lead}</p></section>`;
const checked=(url:string)=>`<p class="small">Source: ${src(url,url.replace('https://',''))}, checked ${CHECKED_ON[url]}. Prices change; check the source before you decide.</p>`;

export const entries:Entry[]=[
{path:'/alternatives/canny',title:'A free alternative to Canny',description:'Dupes Feedback is a free, self-hostable alternative to Canny: boards, votes, roadmap, changelog, REST, MCP and import from Canny.',names:['Canny'],
body:head('ALTERNATIVE TO CANNY','A free alternative<br><em>to Canny.</em>','Feedback boards, votes, roadmap and changelog you can run yourself, without paying by the tracked user.')+`<section class="prose">
<h2>The short version</h2>
<p>Canny is a hosted feedback tool. Dupes Feedback covers the same core job (boards, votes, roadmap and changelog) and is free to self-host (AGPL-3.0). If you'd rather not run a server, a hosted version is coming; there's a waitlist and no price yet.</p>
<h2>Side by side</h2>
<table class="compare"><thead><tr><th></th><th>Canny</th><th>Dupes Feedback</th></tr></thead><tbody>
<tr><th>Free option</th><td>Free plan, 25 tracked users</td><td>Free to self-host, no tracked-user limit</td></tr>
<tr><th>Paid price</th><td>Pro from $79/month billed yearly (100+ tracked users); Business is custom</td><td>Hosted plan not open yet; no price announced</td></tr>
<tr><th>How price grows</th><td>With tracked users, meaning anyone who posts, votes or comments</td><td>Self-hosted: your server cost only</td></tr>
<tr><th>Boards, voting, comments</th><td>Yes</td><td>Yes</td></tr>
<tr><th>Roadmap and changelog</th><td>Yes</td><td>Yes</td></tr>
<tr><th>API / MCP for coding agents</th><td>API, webhooks and MCP connectors listed on its pricing page</td><td>REST and MCP built in</td></tr>
<tr><th>Import from Canny</th><td>n/a</td><td>Yes, with your own Canny API key</td></tr>
<tr><th>Your data lives</th><td>On Canny's servers</td><td>On your server (self-hosted)</td></tr>
</tbody></table>
${checked('https://canny.io/pricing')}
<h2>Who should stay on Canny</h2>
<p>If you need Canny's CRM and support-desk integrations, SSO or SOC 2 paperwork, or you don't want to run anything yourself, Canny is built for that. Dupes Feedback is the better fit when you want ownership of the data, no per-user pricing, or a board your coding agent can read.</p>
<h2>Moving over</h2>
<p>The importer reads posts, votes and comments with your own Canny API key, runs on your machine or server, and never sends your data to us. See <a href="/docs#import">Import from Canny</a>.</p>
${cta}</section>`},
{path:'/alternatives/fider',title:'Dupes Feedback and Fider compared',description:'Fider and Dupes Feedback are both free, self-hostable feedback boards. Where they differ: hosted plans, API and MCP, and Canny import.',names:['Fider'],
body:head('FIDER ALTERNATIVE','Looking at Fider?<br><em>Here is how we compare.</em>','Both are free feedback boards you can host yourself. This is where we differ, and where Fider is the better pick.')+`<section class="prose">
<h2>What Fider does well</h2>
<p>Fider is an established open-source feedback board. Its hosted free plan allows unlimited customers, voting and discussion with a fair-use limit of 250 feedback items, and it lists a Pro plan for more advanced features such as SEO indexing.</p>
<table class="compare"><thead><tr><th>Plan</th><th>Price</th><th>Notes</th></tr></thead><tbody><tr><td>Fider Free</td><td>$0</td><td>Unlimited customers, voting and members; 250 feedback items fair use</td></tr><tr><td>Fider Pro</td><td>$25/month in the plan listing (its FAQ text says $49)</td><td>More advanced features, such as SEO indexing</td></tr><tr><td>Dupes Feedback, self-hosted</td><td>$0 plus your server</td><td>No item cap</td></tr><tr><td>Dupes Feedback, hosted</td><td>Not open yet; no price</td><td>n/a</td></tr></tbody></table>
${checked('https://fider.io/pricing')}
<h2>Where Dupes Feedback differs</h2>
<ul><li>Built-in roadmap and changelog alongside boards and voting.</li><li>REST API and an MCP endpoint, so a coding agent can read requests and close the loop when work ships.</li><li>An importer for Canny, for teams moving off a paid tool.</li><li>A hosted platform you can provision with one API call (hosted access isn't open yet; join the waitlist).</li></ul>
<h2>Where Fider may fit better</h2>
<p>Fider has been around longer and has a larger community. If you only need a simple board and it already does what you need, there's no reason to switch.</p>
${cta}</section>`},
{path:'/alternatives/frill',title:'Dupes Feedback and Frill compared',description:'Frill and Dupes Feedback compared: Frill prices by plan with unlimited tracked users; Dupes Feedback is a free, self-hostable board with REST and MCP built in.',names:['Frill'],
body:head('FRILL ALTERNATIVE','Looking at Frill?<br><em>Here is how we compare.</em>','Frill prices by plan, not by tracked user. Here is where a free, self-hosted board differs.')+`<section class="prose">
<h2>What Frill offers</h2>
<p>Frill's pricing page lists four plans with a 14-day free trial: Startup at $25/month (50 ideas), Business at $49/month, Growth at $149/month and Enterprise at $349/month. All list unlimited tracked users and unlimited teammates. Frill lists a Canny import and a developer API on its feature table.</p>
<table class="compare"><thead><tr><th>Plan</th><th>Price</th><th>Notes</th></tr></thead><tbody><tr><td>Frill Startup</td><td>$25/month</td><td>50 ideas, 1 survey</td></tr><tr><td>Frill Business</td><td>$49/month</td><td>Unlimited ideas, 3 surveys</td></tr><tr><td>Frill Growth</td><td>$149/month</td><td>Privacy, surveys, white labeling</td></tr><tr><td>Frill Enterprise</td><td>$349/month</td><td>SOC2, audit logs, dedicated hosting</td></tr><tr><td>Dupes Feedback, self-hosted</td><td>$0 plus your server</td><td>No idea cap</td></tr><tr><td>Dupes Feedback, hosted</td><td>Not open yet; no price</td><td>n/a</td></tr></tbody></table>
${checked('https://frill.co/pricing')}
<h2>Where Dupes Feedback differs</h2>
<ul><li>Free to self-host (AGPL-3.0), with no cap on ideas and no plan to outgrow.</li><li>Your data stays on your own server.</li><li>Boards, votes, roadmap, changelog, REST and MCP in every install.</li><li>Import from Canny, using your own API key.</li></ul>
<h2>Where Frill may fit better</h2>
<p>Frill is hosted today, with surveys and an embeddable widget. Dupes' hosted plan isn't open yet and has no price. If you want a hosted board now, Frill is a reasonable choice.</p>
${cta}</section>`},
{path:'/alternatives/featurebase',title:'Dupes Feedback and Featurebase compared',description:'Featurebase bundles feedback with a helpdesk and charges per seat. Dupes Feedback is a free, self-hostable feedback board.',names:['Featurebase'],
body:head('FEATUREBASE ALTERNATIVE','Looking at Featurebase?<br><em>Here is how we compare.</em>','Featurebase is a helpdesk with feedback included. Dupes Feedback only does the feedback part, and does it on your server.')+`<section class="prose">
<h2>What Featurebase offers</h2>
<p>Featurebase's pricing page offers one subscription covering helpdesk and feedback. It lists a Free plan with 1 seat, then Growth at $29, Professional at $59 and Enterprise at $99 per seat per month billed yearly, plus $0.49 per AI resolution. Feedback is listed as included in every plan, and API, MCP and webhooks are listed from Growth.</p>
<table class="compare"><thead><tr><th>Plan</th><th>Price</th><th>Notes</th></tr></thead><tbody><tr><td>Featurebase Free</td><td>$0</td><td>1 seat; helpdesk with feedback included</td></tr><tr><td>Featurebase Growth</td><td>$29/seat/month, billed yearly</td><td>API, MCP, webhooks listed</td></tr><tr><td>Featurebase Professional</td><td>$59/seat/month, billed yearly</td><td>Workflows, SLAs, Salesforce and HubSpot</td></tr><tr><td>Featurebase Enterprise</td><td>$99/seat/month, billed yearly</td><td>SSO, custom admin roles</td></tr><tr><td>Dupes Feedback, self-hosted</td><td>$0 plus your server</td><td>Feedback only; no helpdesk</td></tr><tr><td>Dupes Feedback, hosted</td><td>Not open yet; no price</td><td>n/a</td></tr></tbody></table>
${checked('https://featurebase.app/pricing')}
<h2>Where Dupes Feedback differs</h2>
<ul><li>Feedback only: boards, votes, comments, roadmap and changelog, with no helpdesk to pay for or ignore.</li><li>Free to self-host (AGPL-3.0), with no per-seat pricing.</li><li>REST and MCP in every install, and import from Canny.</li></ul>
<h2>Where Featurebase may fit better</h2>
<p>If you also want live chat, a shared inbox and an AI support agent in the same tool, Featurebase covers that and Dupes doesn't. Dupes' hosted plan isn't open yet and has no price.</p>
${cta}</section>`},
{path:'/alternatives/upvoty',title:'Dupes Feedback and Upvoty compared',description:'Upvoty and Dupes Feedback compared: flat monthly plans versus a free, self-hostable board with REST and MCP built in.',names:['Upvoty'],
body:head('UPVOTY ALTERNATIVE','Looking at Upvoty?<br><em>Here is how we compare.</em>','Upvoty prices by plan, not by tracked user. That makes it one of the fairer hosted options. Here is where Dupes differs.')+`<section class="prose">
<h2>What Upvoty offers</h2>
<p>Upvoty lists three plans with a 14-day free trial: Power at $15/month, Super at $25/month and Hyper at $49/month (billed monthly), all with unlimited boards and unlimited tracked users. The changelog is listed from Super up; API, webhooks and an Upvoty MCP are listed on Hyper.</p>
<table class="compare"><thead><tr><th>Plan</th><th>Price (billed monthly)</th><th>Notes</th></tr></thead><tbody><tr><td>Upvoty Power</td><td>$15/month</td><td>1 project, unlimited boards and tracked users, public roadmap, API access listed</td></tr><tr><td>Upvoty Super</td><td>$25/month</td><td>Adds changelog and all integrations</td></tr><tr><td>Upvoty Hyper</td><td>$49/month</td><td>Unlimited projects, Upvoty MCP, API and webhooks</td></tr><tr><td>Dupes Feedback, self-hosted</td><td>$0 plus your server</td><td>Roadmap, changelog, REST and MCP in every install</td></tr><tr><td>Dupes Feedback, hosted</td><td>Not open yet; no price</td><td>n/a</td></tr></tbody></table>
${checked('https://upvoty.com/pricing')}
<h2>Where Dupes Feedback differs</h2>
<ul><li>Free to self-host (AGPL-3.0), so your data stays on your server and there is no monthly plan to outgrow.</li><li>Roadmap, changelog, REST and MCP are in every install, not tied to a tier.</li><li>Import from Canny for teams leaving a paid tool.</li></ul>
<h2>Where Upvoty may fit better</h2>
<p>Upvoty is hosted today at a clear price. Dupes' hosted plan isn't open yet and has no price. If you want a hosted board now and don't mind a subscription, Upvoty is a reasonable choice.</p>
${cta}</section>`},
{path:'/blog/what-does-a-feedback-board-cost',title:'What does a feedback board cost? Four pricing models compared',description:'Per tracked user, flat plans, free with a cap, or self-hosted: how feedback-board pricing works and which fits you.',names:['Canny','Upvoty','Fider'],date:'2026-10-20',
body:head('PRICING EXPLAINED','What does a feedback board cost?<br><em>Four models compared.</em>','The headline price rarely tells you what you will pay once your users start voting.')+`<section class="prose">
<h2>1. Per tracked user</h2>
<p>Canny's free plan covers 25 tracked users; Pro is listed from $79/month billed yearly for 100+ tracked users. The bill follows your audience.</p>${checked('https://canny.io/pricing')}
<h2>2. Flat plans</h2>
<p>Upvoty lists $15, $25 and $49 a month with unlimited tracked users; what changes between plans is features such as changelog, integrations and API.</p>${checked('https://upvoty.com/pricing')}
<h2>3. Free with a cap</h2>
<p>Fider's hosted free plan allows unlimited customers, voting and members, with a fair-use limit of 250 feedback items.</p>${checked('https://fider.io/pricing')}
<h2>4. Self-hosted</h2>
<p>Dupes Feedback is free to run on your own server: you pay for the server, and for the time backups and updates take. See <a href="/docs">the setup guide</a>.</p>
<h2>Which to pick</h2>
<ul><li>Under 25 people giving feedback: a free plan is enough.</li><li>Large, active audience: avoid per-user pricing, or host it yourself.</li><li>No appetite for servers: a flat hosted plan.</li><li>Want data ownership or agent access: self-host.</li></ul>
${cta}</section>`},
{path:'/blog/self-hosting-a-feedback-board',title:'Self-hosting a feedback board: what you actually take on',description:'Self-hosting a feedback board saves money and keeps your data. It also makes backups, updates and uptime your job. A plain checklist.',names:[],date:'2026-10-20',
body:head('SELF-HOSTING','Self-hosting a feedback board:<br><em>what you actually take on.</em>','Free software is not free of work. Here is the honest list.')+`<section class="prose">
<p>A feedback board is a small app: a web server, a database, and some email. That makes it a good first thing to self-host. It still isn't nothing.</p>
<h2>What you gain</h2>
<ul><li><strong>Your data stays with you.</strong> Votes, comments and customer emails live on a server you control.</li><li><strong>No pricing that follows your audience.</strong> Your cost is the server.</li><li><strong>Freedom to leave.</strong> You hold the database, so there's no export to request.</li></ul>
<h2>What you take on</h2>
<ul><li><strong>Backups.</strong> Copy the data volume somewhere else on a schedule, and try restoring it once.</li><li><strong>Updates.</strong> Apply new releases, including security fixes.</li><li><strong>Uptime.</strong> If the server is down, so is the board.</li><li><strong>Email.</strong> Notifications need a mail provider you configure.</li><li><strong>Privacy duties.</strong> You are the one holding your customers' emails, so your own privacy notice should say so.</li></ul>
<h2>When it makes sense</h2>
<p>When you already run a server, care where the data lives, or want a board your own agents can read through REST or MCP. If you'd rather not, that's what a hosted plan is for; ours isn't open yet, and you can <a href="/waitlist?utm_source=content">join the waitlist</a>.</p>
<p>Dupes Feedback is built as one process and one data volume, to keep this list short. The <a href="/docs#self-host">setup guide</a> has the details.</p>
${cta}</section>`},
{path:'/blog/what-is-a-tracked-user',title:'What is a tracked user, and why does feedback software charge for them?',description:'Many feedback tools price by tracked user: anyone who posts, votes or comments. Why that is awkward, what it costs, and the alternatives.',names:['Canny'],date:'2026-10-20',
body:head('PRICING EXPLAINED','What is a tracked user, and why does your feedback board<br><em>charge for them?</em>','Pricing that grows with your audience is a strange fit for a tool whose job is to hear from your audience.')+`<section class="prose">
<p>Canny defines a tracked user as someone who has given feedback: creating a post, or voting or commenting on one, whether they did it themselves, an admin did it on their behalf, or its AI did. Its free plan includes 25 tracked users; Pro starts at $79/month billed yearly for 100+ tracked users; plans above 5,000 are Business, priced on request.</p>
${checked('https://canny.io/pricing')}
<h2>Why it's awkward</h2>
<p>A feedback board works best when more customers vote. Every extra voter moves you toward the next price tier. A popular launch, a viral request, or an invite to your whole user base can change next month's bill, which nudges you to ask for less feedback.</p>
<h2>Ways out</h2>
<ol><li><strong>Stay small.</strong> If you have fewer than 25 people giving feedback, a free plan is fine.</li><li><strong>Pick a flat-price tool.</strong> Some tools charge per admin seat or a flat monthly fee instead.</li><li><strong>Host it yourself.</strong> An open-source board costs the price of a small server and your time. Dupes Feedback is one process and one data volume, with <a href="/alternatives/canny">import from Canny</a> if you already have a board.</li></ol>
<h2>A fair check before you leave</h2>
<p>Self-hosting means backups, updates and uptime are yours. If that isn't what you want, a hosted plan with predictable pricing is the better answer; we're building one, and you can <a href="/waitlist?utm_source=content">join the waitlist</a>.</p>
${cta}</section>`},
{path:'/blog/can-your-coding-agent-read-your-feedback-board',title:'Can your coding agent read your feedback board?',description:'Feedback boards were built for people. Here is what changes when your coding agent can read requests, and close them when work ships.',names:['Canny'],date:'2026-10-20',
body:head('AGENTS AND FEEDBACK','Can your coding agent<br><em>read your feedback board?</em>','Most feedback tools were designed for product managers clicking through a dashboard. That is changing.')+`<section class="prose">
<p>If an agent writes your code, the loop that matters is: a customer asks, you decide, the agent builds it, the customer hears it shipped. Each step through a dashboard is a place the loop breaks.</p>
<h2>What an agent needs</h2>
<ul><li><strong>Read access</strong> to requests, vote counts and comments, through an API or an MCP server.</li><li><strong>Write access</strong> to change a request's status and post a changelog entry.</li><li><strong>A scoped key,</strong> so it can only touch the board.</li></ul>
<h2>What's on offer</h2>
<p>Canny's pricing page lists MCP connectors (OpenAI, Claude, ClickUp, Cursor) and an API with webhooks.</p>
${checked('https://canny.io/pricing')}
<p>Dupes Feedback ships REST and MCP in the box, on a free self-hosted install or a hosted instance provisioned with one API call. The same board runs <a href="/vote">our own vote for the next dupe</a>, so you can see it working.</p>
<h2>One caution</h2>
<p>Let the agent propose status changes rather than publish customer-facing posts on its own. A human reading the changelog before it goes out is cheap insurance.</p>
${cta}</section>`}
];
export function contentPage(path:string):Entry|'index'|undefined {
  if(path==='/alternatives'||path==='/blog')return 'index';
  return entries.find(e=>e.path===path);
}
export function indexPage(path:string):Entry {
  const alt=path==='/alternatives',list=entries.filter(e=>e.path.startsWith(alt?'/alternatives/':'/blog/'));
  return {path,title:alt?'Alternatives to paid tools':'Notes on feedback and pricing',description:alt?'Honest comparisons between Dupes and the paid tools it replaces.':'Problem-led notes on feedback boards, pricing and agents.',names:[...new Set(list.flatMap(e=>e.names))],
    body:head(alt?'ALTERNATIVES':'THE BLOG',alt?'Honest<br><em>comparisons.</em>':'Notes on<br><em>feedback.</em>',alt?'Every figure has a source and a checked date.':'Problems first. Product second.')+`<section class="prose">${list.map(e=>`<h2><a href="${e.path}">${e.title}</a></h2><p>${e.description}</p>`).join('')}</section>`};
}
export const sitemapPaths=['/','/catalogue','/docs','/vote','/waitlist','/alternatives','/blog',...entries.map(e=>e.path)];
