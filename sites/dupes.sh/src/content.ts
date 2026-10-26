// Alternative/comparison pages and problem-led posts. Competitor facts come only from their public pages (source + checked date).
// Each source carries its own checked date; change only the one you re-checked.
const CHECKED_ON:Record<string,string>={'https://canny.io/pricing':'2026-10-25','https://fider.io/pricing':'2026-10-20','https://upvoty.com/pricing':'2026-10-25','https://featurebase.app/pricing':'2026-10-20','https://frill.co/pricing':'2026-10-25'};
type Entry={path:string;title:string;description:string;names:string[];date?:string;body:string};
const src=(href:string,label:string)=>`<a href="${href}" rel="nofollow noopener">${label}</a>`;
const cta=`<p><a class="button" href="/vote">Try the live voting board<span aria-hidden="true"> ↗</span></a> <a class="button secondary" href="/i/next-dupe/?board=candidates">Open the live board<span aria-hidden="true"> ↗</span></a> <a class="button secondary" href="/signup?utm_source=content">Start free hosted<span aria-hidden="true"> ↗</span></a></p>`;
// Internal CTAs preserve the landing source already held by the site script.
const newBoardCta=`<h2>Start your own feedback board</h2><p>Try posting, voting and following a roadmap in the public demo. No signup is needed; demo content is public and resets daily. Ready for your own board? Free hosted includes one Feedback instance per workspace.</p><p><a class="button" href="/signup">Start free hosted<span aria-hidden="true"> ↗</span></a> <a class="button secondary" href="/demo">Try the demo<span aria-hidden="true"> ↗</span></a></p><p class="small">Save your workspace key when you sign up. Email sign-in and lost-key recovery are not available yet.</p>`;
const head=(eyebrow:string,h1:string,lead:string)=>`<section class="page-head compact"><p class="eyebrow">${eyebrow}</p><h1>${h1}</h1><p class="lead">${lead}</p></section>`;
const checked=(url:string)=>`<p class="small">Source: ${src(url,url.replace('https://',''))}, checked ${CHECKED_ON[url]}. Prices change; check the source before you decide.</p>`;

export const entries:Entry[]=[
{path:'/alternatives/canny',title:'A free alternative to Canny',description:'Dupes Feedback is a free, self-hostable alternative to Canny: boards, votes, roadmap, changelog, REST, MCP and import from Canny.',names:['Canny'],
body:head('ALTERNATIVE TO CANNY','A free alternative<br><em>to Canny.</em>','Feedback boards, votes, roadmap and changelog you can run yourself, without paying by the tracked user.')+`<section class="prose">
<h2>The short version</h2>
<p>Canny is a hosted feedback tool. Dupes Feedback covers the same core job (boards, votes, roadmap and changelog) and is free to self-host (AGPL-3.0). If you'd rather not run a server, a free hosted workspace is live at <a href="/signup">/signup</a>. One instance per workspace, no tracked-user limit. Paid plans come later; no price is set yet.</p>
<h2>Side by side</h2>
<table class="compare"><thead><tr><th></th><th>Canny</th><th>Dupes Feedback</th></tr></thead><tbody>
<tr><th>Free option</th><td>Free plan, 25 tracked users</td><td>Free to self-host, no tracked-user limit</td></tr>
<tr><th>Paid price</th><td>Pro from $79/month billed yearly (100+ tracked users); Business is custom</td><td>Hosted Free: one instance per workspace; paid plans not priced yet</td></tr>
<tr><th>How price grows</th><td>With tracked users, meaning anyone who posts, votes or comments</td><td>Self-hosted: your server cost only</td></tr>
<tr><th>Boards, voting, comments</th><td>Yes</td><td>Yes</td></tr>
<tr><th>Roadmap and changelog</th><td>Yes</td><td>Yes</td></tr>
<tr><th>API / MCP for coding agents</th><td>API, webhooks and MCP connectors listed on its pricing page</td><td>REST and MCP built in</td></tr>
<tr><th>Import from Canny</th><td>n/a</td><td>Yes, with your own Canny API key, self-hosted or hosted</td></tr>
<tr><th>Your data lives</th><td>On Canny's servers</td><td>On your server (self-hosted), or Cloudflare Workers and D1 (hosted)</td></tr>
</tbody></table>
${checked('https://canny.io/pricing')}
<h2>Who should stay on Canny</h2>
<p>If you need Canny's CRM and support-desk integrations, SSO or SOC 2 paperwork, or you don't want to run anything yourself, Canny is built for that. Dupes Feedback is the better fit when you want ownership of the data, no per-user pricing, or a board your coding agent can read.</p>
<h2>Moving over</h2>
<p>The importer reads boards, users, posts, votes, comments and changelog with your own Canny API key. Self-hosted, it runs on your machine or server and never sends your data to us. On a hosted workspace, run it from your admin page: your key is used for the import only and never stored, and your Canny data is sent to Dupes and stored in your workspace. See <a href="/docs#import">Import from Canny</a>.</p>
${cta}</section>`},
{path:'/alternatives/fider',title:'Dupes Feedback and Fider compared',description:'Fider and Dupes Feedback are both free, self-hostable feedback boards. Where they differ: hosted plans, API and MCP, and Canny import.',names:['Fider'],
body:head('FIDER ALTERNATIVE','Looking at Fider?<br><em>Here is how we compare.</em>','Both are free feedback boards you can host yourself. This is where we differ, and where Fider is the better pick.')+`<section class="prose">
<h2>What Fider does well</h2>
<p>Fider is an established open-source feedback board. Its hosted free plan allows unlimited customers, voting and discussion with a fair-use limit of 250 feedback items, and it lists a Pro plan for more advanced features such as SEO indexing.</p>
<table class="compare"><thead><tr><th>Plan</th><th>Price</th><th>Notes</th></tr></thead><tbody><tr><td>Fider Free</td><td>$0</td><td>Unlimited customers, voting and members; 250 feedback items fair use</td></tr><tr><td>Fider Pro</td><td>$25/month in the plan listing (its FAQ text says $49)</td><td>More advanced features, such as SEO indexing</td></tr><tr><td>Dupes Feedback, self-hosted</td><td>$0 plus your server</td><td>No item cap</td></tr><tr><td>Dupes Feedback, hosted</td><td>Free workspace</td><td>One instance; no tracked-user limit; paid plans later, no price yet</td></tr></tbody></table>
${checked('https://fider.io/pricing')}
<h2>Where Dupes Feedback differs</h2>
<ul><li>Built-in roadmap and changelog alongside boards and voting.</li><li>REST API and an MCP endpoint, so a coding agent can read requests and close the loop when work ships.</li><li>An importer for Canny, for teams moving off a paid tool.</li><li>A hosted platform you can provision with one API call (one free hosted instance per workspace; <a href="/signup">start now</a>).</li></ul>
<h2>Where Fider may fit better</h2>
<p>Fider has been around longer and has a larger community. If you only need a simple board and it already does what you need, there's no reason to switch.</p>
${cta}</section>`},
{path:'/alternatives/frill',title:'Dupes Feedback and Frill compared',description:'Frill and Dupes Feedback compared: Frill prices by plan with unlimited tracked users; Dupes Feedback is a free, self-hostable board with REST and MCP built in.',names:['Frill'],
body:head('FRILL ALTERNATIVE','Looking at Frill?<br><em>Here is how we compare.</em>','Frill prices by plan, not by tracked user. Here is where a free, self-hosted board differs.')+`<section class="prose">
<h2>What Frill offers</h2>
<p>Frill's pricing page lists four plans with a 14-day free trial: Startup at $25/month (50 ideas), Business at $49/month, Growth at $149/month and Enterprise at $349/month. All list unlimited tracked users and unlimited teammates. Frill lists a Canny import and a developer API on its feature table.</p>
<table class="compare"><thead><tr><th>Plan</th><th>Price</th><th>Notes</th></tr></thead><tbody><tr><td>Frill Startup</td><td>$25/month</td><td>50 ideas, 1 survey</td></tr><tr><td>Frill Business</td><td>$49/month</td><td>Unlimited ideas, 3 surveys</td></tr><tr><td>Frill Growth</td><td>$149/month</td><td>Privacy, surveys, white labeling</td></tr><tr><td>Frill Enterprise</td><td>$349/month</td><td>SOC2, audit logs, dedicated hosting</td></tr><tr><td>Dupes Feedback, self-hosted</td><td>$0 plus your server</td><td>No idea cap</td></tr><tr><td>Dupes Feedback, hosted</td><td>Free workspace</td><td>One instance; no tracked-user limit; paid plans later, no price yet</td></tr></tbody></table>
${checked('https://frill.co/pricing')}
<h2>Where Dupes Feedback differs</h2>
<ul><li>Free to self-host (AGPL-3.0), with no cap on ideas and no plan to outgrow.</li><li>Your data stays on your own server.</li><li>Boards, votes, roadmap, changelog, REST and MCP in every install.</li><li>Import from Canny, using your own API key.</li></ul>
<h2>Where Frill may fit better</h2>
<p>Frill is hosted today, with surveys and an embeddable widget. Dupes offers one free hosted instance per workspace, with no tracked-user limit. Paid plans come later; no price is set yet. If you want a hosted board now, Frill is a reasonable choice.</p>
${cta}</section>`},
{path:'/alternatives/featurebase',title:'Dupes Feedback and Featurebase compared',description:'Featurebase bundles feedback with a helpdesk and charges per seat. Dupes Feedback is a free, self-hostable feedback board.',names:['Featurebase'],
body:head('FEATUREBASE ALTERNATIVE','Looking at Featurebase?<br><em>Here is how we compare.</em>','Featurebase is a helpdesk with feedback included. Dupes Feedback only does the feedback part, and does it on your server.')+`<section class="prose">
<h2>What Featurebase offers</h2>
<p>Featurebase's pricing page offers one subscription covering helpdesk and feedback. It lists a Free plan with 1 seat, then Growth at $29, Professional at $59 and Enterprise at $99 per seat per month billed yearly, plus $0.49 per AI resolution. Feedback is listed as included in every plan, and API, MCP and webhooks are listed from Growth.</p>
<table class="compare"><thead><tr><th>Plan</th><th>Price</th><th>Notes</th></tr></thead><tbody><tr><td>Featurebase Free</td><td>$0</td><td>1 seat; helpdesk with feedback included</td></tr><tr><td>Featurebase Growth</td><td>$29/seat/month, billed yearly</td><td>API, MCP, webhooks listed</td></tr><tr><td>Featurebase Professional</td><td>$59/seat/month, billed yearly</td><td>Workflows, SLAs, Salesforce and HubSpot</td></tr><tr><td>Featurebase Enterprise</td><td>$99/seat/month, billed yearly</td><td>SSO, custom admin roles</td></tr><tr><td>Dupes Feedback, self-hosted</td><td>$0 plus your server</td><td>Feedback only; no helpdesk</td></tr><tr><td>Dupes Feedback, hosted</td><td>Free workspace</td><td>One instance; no tracked-user limit; paid plans later, no price yet</td></tr></tbody></table>
${checked('https://featurebase.app/pricing')}
<h2>Where Dupes Feedback differs</h2>
<ul><li>Feedback only: boards, votes, comments, roadmap and changelog, with no helpdesk to pay for or ignore.</li><li>Free to self-host (AGPL-3.0), with no per-seat pricing.</li><li>REST and MCP in every install, and import from Canny.</li></ul>
<h2>Where Featurebase may fit better</h2>
<p>If you also want live chat, a shared inbox and an AI support agent in the same tool, Featurebase covers that and Dupes doesn't. Dupes offers one free hosted instance per workspace, with no tracked-user limit. Paid plans come later; no price is set yet.</p>
${cta}</section>`},
{path:'/alternatives/upvoty',title:'Dupes Feedback and Upvoty compared',description:'Upvoty and Dupes Feedback compared: flat monthly plans versus a free, self-hostable board with REST and MCP built in.',names:['Upvoty'],
body:head('UPVOTY ALTERNATIVE','Looking at Upvoty?<br><em>Here is how we compare.</em>','Upvoty prices by plan, not by tracked user. That makes it one of the fairer hosted options. Here is where Dupes differs.')+`<section class="prose">
<h2>What Upvoty offers</h2>
<p>Upvoty lists three plans with a 14-day free trial: Power at $15/month, Super at $25/month and Hyper at $49/month (billed monthly), all with unlimited boards and unlimited tracked users. The changelog is listed from Super up; API, webhooks and an Upvoty MCP are listed on Hyper.</p>
<table class="compare"><thead><tr><th>Plan</th><th>Price (billed monthly)</th><th>Notes</th></tr></thead><tbody><tr><td>Upvoty Power</td><td>$15/month</td><td>1 project, unlimited boards and tracked users, public roadmap, API access listed</td></tr><tr><td>Upvoty Super</td><td>$25/month</td><td>Adds changelog and all integrations</td></tr><tr><td>Upvoty Hyper</td><td>$49/month</td><td>Unlimited projects, Upvoty MCP, API and webhooks</td></tr><tr><td>Dupes Feedback, self-hosted</td><td>$0 plus your server</td><td>Roadmap, changelog, REST and MCP in every install</td></tr><tr><td>Dupes Feedback, hosted</td><td>Free workspace</td><td>One instance; no tracked-user limit; paid plans later, no price yet</td></tr></tbody></table>
${checked('https://upvoty.com/pricing')}
<h2>Where Dupes Feedback differs</h2>
<ul><li>Free to self-host (AGPL-3.0), so your data stays on your server and there is no monthly plan to outgrow.</li><li>Roadmap, changelog, REST and MCP are in every install, not tied to a tier.</li><li>Import from Canny for teams leaving a paid tool.</li></ul>
<h2>Where Upvoty may fit better</h2>
<p>Upvoty is hosted today at a clear price. Dupes offers one free hosted instance per workspace, with no tracked-user limit. Paid plans come later; no price is set yet. If you want a hosted board now and don't mind a subscription, Upvoty is a reasonable choice.</p>
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
<p>When you already run a server, care where the data lives, or want a board your own agents can read through REST or MCP. If you'd rather not, that's what a hosted plan is for; ours offers one free instance per workspace. You can <a href="/signup?utm_source=content">start free hosted</a>; paid plans are not priced yet.</p>
<p>Dupes Feedback is built as one process and one data volume, to keep this list short. The <a href="/docs#self-host">setup guide</a> has the details.</p>
${cta}</section>`},
{path:'/blog/feedback-board-cost-at-1000-and-10000-users',title:'What a feedback board costs at 1,000 and 10,000 tracked users',description:'What the public pricing pages say a feedback board costs when 1,000 or 10,000 people vote, and where the price is only available by asking.',names:['Canny','Upvoty','Frill','Fider','Featurebase'],date:'2026-10-20',
body:head('PRICING EXPLAINED','What a feedback board costs at<br><em>1,000 and 10,000 tracked users.</em>','We read the public pricing pages. Some give a number at that size. Some only say "talk to us".')+`<section class="prose">
<p>A tracked user is anyone who posts, votes or comments. Say 1,000 people vote on your board this year, or 10,000. Here is what each public pricing page tells you.</p>
<table class="compare"><thead><tr><th>Tool</th><th>At 1,000 tracked users</th><th>At 10,000 tracked users</th></tr></thead><tbody>
<tr><td>Canny</td><td>Pro, listed from $79/month billed yearly for 100+ tracked users; the page has a calculator for the exact figure</td><td>Above the 5,000+ Business tier, which shows "Let's talk" and no public price</td></tr>
<tr><td>Upvoty</td><td>$15, $25 or $49/month, depending on features</td><td>The same; plans list unlimited tracked users</td></tr>
<tr><td>Frill</td><td>$25 to $349/month, depending on plan</td><td>The same; plans list unlimited tracked users</td></tr>
<tr><td>Fider</td><td>Free plan, capped at 250 feedback items</td><td>The same cap; a Pro plan is listed for more features</td></tr>
<tr><td>Featurebase</td><td>Priced per seat ($29 to $99/month billed yearly), not per voter</td><td>The same</td></tr>
<tr><td>Dupes Feedback, self-hosted</td><td>Your server cost</td><td>Your server cost</td></tr>
</tbody></table>
<p class="small">Sources: ${src('https://canny.io/pricing','canny.io/pricing')}, ${src('https://upvoty.com/pricing','upvoty.com/pricing')}, ${src('https://frill.co/pricing','frill.co/pricing')}, ${src('https://fider.io/pricing','fider.io/pricing')}, ${src('https://featurebase.app/pricing','featurebase.app/pricing')}, all checked 2026-10-20. Prices change; check the source.</p>
<h2>What to take from it</h2>
<ul><li>Per-voter pricing is the one that moves with your audience. Flat plans and per-seat plans don't.</li><li>"Talk to us" means you can't budget from the pricing page. Ask before you commit.</li><li>Plans differ in features as much as price. Check which ones you need, such as changelog, API or SSO.</li></ul>
<p>We make a free, self-hostable feedback board, Dupes Feedback. Its cost is your server. Try the <a href="/vote">live voting board</a>.</p></section>`},
{path:'/blog/per-user-pricing-punishes-your-best-customers',title:'Why per-user pricing punishes your best customers',description:'Feedback tools that price by tracked user charge more when more customers speak up. Why that is backwards, and what to look for instead.',names:['Canny'],date:'2026-10-20',
body:head('OPINION','Why per-user pricing punishes<br><em>your best customers.</em>','The customers who vote, comment and ask for things are the ones you most want to hear from.')+`<section class="prose">
<p>Think about who ends up on a feedback board. Not the customers who quietly left. The engaged ones: they post an idea, vote on three more, and come back to see what shipped.</p>
<p>When a tool charges by tracked user, each of them is a line on your bill. Canny defines a tracked user as someone who has given feedback, by posting, voting or commenting (${src('https://canny.io/pricing','canny.io/pricing')}, checked 2026-10-20). Its free plan covers 25.</p>
<h2>The incentive is backwards</h2>
<p>You want more customers to speak up. The price wants fewer. Teams respond in quiet ways: they stop inviting the whole base, hide the board behind a login, or merge feedback into a spreadsheet when the next tier comes into view.</p>
<h2>What to look for instead</h2>
<ul><li><strong>Price by something you control,</strong> like seats or features, not by how many customers talk.</li><li><strong>A way out.</strong> You should be able to export your data, or run the tool yourself.</li><li><strong>No surprise at the next tier.</strong> If a price is "contact us", ask the question before you invite your users.</li></ul>
<p>That's why we're building Dupes Feedback as a free, self-hostable board: nothing on it grows with the number of people who vote. Come and vote on the <a href="/vote">next dupe</a>.</p></section>`},
{path:'/blog/what-is-a-tracked-user',title:'What is a tracked user, and why does feedback software charge for them?',description:'Many feedback tools price by tracked user: anyone who posts, votes or comments. Why that is awkward, what it costs, and the alternatives.',names:['Canny'],date:'2026-10-20',
body:head('PRICING EXPLAINED','What is a tracked user, and why does your feedback board<br><em>charge for them?</em>','Pricing that grows with your audience is a strange fit for a tool whose job is to hear from your audience.')+`<section class="prose">
<p>Canny defines a tracked user as someone who has given feedback: creating a post, or voting or commenting on one, whether they did it themselves, an admin did it on their behalf, or its AI did. Its free plan includes 25 tracked users; Pro starts at $79/month billed yearly for 100+ tracked users; plans above 5,000 are Business, priced on request.</p>
${checked('https://canny.io/pricing')}
<h2>Why it's awkward</h2>
<p>A feedback board works best when more customers vote. Every extra voter moves you toward the next price tier. A popular launch, a viral request, or an invite to your whole user base can change next month's bill, which nudges you to ask for less feedback.</p>
<h2>Ways out</h2>
<ol><li><strong>Stay small.</strong> If you have fewer than 25 people giving feedback, a free plan is fine.</li><li><strong>Pick a flat-price tool.</strong> Some tools charge per admin seat or a flat monthly fee instead.</li><li><strong>Host it yourself.</strong> An open-source board costs the price of a small server and your time. Dupes Feedback is one process and one data volume, with <a href="/alternatives/canny">import from Canny</a> if you already have a board.</li></ol>
<h2>A fair check before you leave</h2>
<p>Self-hosting means backups, updates and uptime are yours. If that isn't what you want, a hosted plan with predictable pricing is the better answer; we offer one free hosted instance per workspace, with paid plans not priced yet. You can <a href="/signup?utm_source=content">start here</a>.</p>
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
${cta}</section>`},
{path:'/blog/roadmap-vs-changelog',title:'Roadmap vs changelog: what each one is for',description:'A roadmap says what you might build. A changelog says what you did. Why a feedback board needs both, and how to keep them honest.',names:[],date:'2026-10-22',
body:head('PRODUCT BASICS','Roadmap vs changelog:<br><em>what each is for</em>','One looks forward, one looks back. Mixing them up costs you trust.')+`<section class="prose">
<p>A customer asks for something on your feedback board. Two questions follow: will you build it, and did you? A roadmap answers the first. A changelog answers the second.</p>
<h2>The roadmap</h2>
<p>A roadmap is a list of what you are considering, building or have decided against. Keep it to a few honest states, such as <em>planned</em>, <em>in progress</em> and <em>not planned</em>. Leave out dates you can't keep: a date you miss does more damage than no date.</p>
<h2>The changelog</h2>
<p>A changelog is a dated list of what shipped, written for the people who asked. One line per change is enough, with a link back to the request that prompted it.</p>
<h2>Why the board needs both</h2>
<ul><li><strong>Voters get an answer.</strong> A request with no status looks ignored. A status, even "not planned", tells people you read it.</li><li><strong>Shipping closes the loop.</strong> When a request moves to done and a changelog entry appears, everyone who voted can see their vote counted.</li><li><strong>It keeps you honest.</strong> A changelog is a record. If the roadmap says "planned" for six months and nothing appears, the gap is visible.</li></ul>
<h2>A small habit that works</h2>
<p>When you ship, change the request's status first and write the changelog line second, in the same sitting. Doing both together is easier than catching up later.</p>
<p>Dupes Feedback has a public board, a roadmap and a changelog in one place. Try them on the <a href="/demo">public Feedback demo</a>.</p>
${newBoardCta}</section>`},
{path:'/blog/how-to-get-customers-to-use-your-feedback-board',title:'How to get customers to actually use your feedback board',description:'Most feedback boards sit empty. Five plain habits that get customers to post and vote, none of which involve a bigger widget.',names:[],date:'2026-10-22',
body:head('FEEDBACK HABITS','How to get customers to<br><em>actually use your board</em>','An empty board is a worse signal than no board. Here is what fills one.')+`<section class="prose">
<p>Setting up a feedback board takes an afternoon. Getting people to use it takes habits. These five are cheap and work for most small products.</p>
<h2>1. Seed it yourself</h2>
<p>A blank board tells visitors nobody cares. Before you share it, add the ten requests you hear most often, in the customers' own words.</p>
<h2>2. Link it where the question comes up</h2>
<p>When support hears "can you add X?", reply with a link to the board post for X, or create it and then link it. People vote on things they are pointed to.</p>
<h2>3. Answer fast, even with no</h2>
<p>A reply within a day, including "not planned, and here is why", teaches people that posting is worth the effort.</p>
<h2>4. Tell voters when it ships</h2>
<p>Everyone who voted should hear when a request is done. That one message is what turns a voter into a repeat voter. See <a href="/blog/roadmap-vs-changelog">roadmap vs changelog</a> for how to keep that record.</p>
<h2>5. Don't let the price decide who may vote</h2>
<p>If your tool charges by the number of people who speak up, you will be tempted to invite fewer of them. Check <a href="/blog/what-is-a-tracked-user">how your tool counts users</a> before you invite everyone, or pick a board where voting is not what you pay for.</p>
${newBoardCta}</section>`}
];
export function contentPage(path:string):Entry|'index'|undefined {
  if(path==='/alternatives'||path==='/blog')return 'index';
  return entries.find(e=>e.path===path);
}
export function indexPage(path:string):Entry {
  const alt=path==='/alternatives',list=entries.filter(e=>e.path.startsWith(alt?'/alternatives/':'/blog/'));
  return {path,title:alt?'Alternatives to paid tools':'Notes on feedback and pricing',description:alt?'Honest comparisons between Dupes and the paid tools it replaces.':'Problem-led notes on feedback boards, pricing and agents.',names:[...new Set(list.flatMap(e=>e.names))],
    body:head(alt?'ALTERNATIVES':'THE BLOG',alt?'Honest<br><em>comparisons.</em>':'Notes on<br><em>feedback.</em>',alt?'Every figure has a source and a checked date.':'Problems first. Product second.')+`<section class="prose">${alt?'':'<p class="small"><a href="/blog/rss.xml">RSS feed</a></p>'}${list.map(e=>`<h2><a href="${e.path}">${e.title}</a></h2><p>${e.description}</p>`).join('')}</section>`};
}
export function rssFeed(origin:string):string {
  const esc=(v:string)=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const posts=entries.filter(e=>e.date&&e.path.startsWith('/blog/')).sort((a,b)=>b.date!.localeCompare(a.date!));
  return '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Dupes blog</title><link>'+origin+'/blog</link><description>Problem-led notes on feedback boards, pricing and agents.</description>'+posts.map(e=>'<item><title>'+esc(e.title)+'</title><link>'+origin+e.path+'</link><guid>'+origin+e.path+'</guid><pubDate>'+new Date(e.date+'T09:00:00Z').toUTCString()+'</pubDate><description>'+esc(e.description)+'</description></item>').join('')+'</channel></rss>';
}
export const sitemapPaths=['/','/demo','/signup','/catalogue','/docs','/vote','/waitlist','/alternatives','/blog',...entries.map(e=>e.path)];
