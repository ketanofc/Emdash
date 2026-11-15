export interface TemplateItem {
  id: string;
  title: string;
  description: string;
  prompt: string;
  hue: number;
  slug: string;
  previewHtml: string;
}

export interface QuickChipItem {
  label: string;
  prompt: string;
  templateId: string;
}

export const QUICK_CHIPS: QuickChipItem[] = [
  {
    label: "Todo app",
    prompt: "Build a todo app with status filters and local storage persistence",
    templateId: "todo-app",
  },
  {
    label: "Coffee landing page",
    prompt: "Build a landing page for an artisan coffee roastery",
    templateId: "coffee-landing",
  },
  {
    label: "Photo portfolio",
    prompt: "Build a minimal portfolio site for an editorial photographer",
    templateId: "photo-portfolio",
  },
  {
    label: "Pricing page",
    prompt: "Build a SaaS pricing page with a monthly and yearly billing toggle",
    templateId: "pricing-page",
  },
];

export const ROTATING_PLACEHOLDERS = [
  "a habit tracker with a weekly streak view",
  "a landing page for a coffee roastery",
  "a pricing page with a monthly and yearly toggle",
  "a portfolio site for a photographer",
];

export const TEMPLATES: TemplateItem[] = [
  {
    id: "todo-app",
    title: "Todo app",
    description: "Task list with filters and persistence",
    prompt: "Build a clean todo app with All, Active, and Completed filters and local storage persistence",
    hue: 205,
    slug: "todo-app",
    previewHtml: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Todo App</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f6f6f6;color:#09090b;padding:36px 16px}
.box{max-width:460px;margin:0 auto;background:#fff;border:1px solid #d4d4d8;padding:24px}
.k{font-family:ui-monospace,monospace;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#ff5401;margin-bottom:6px}
h1{margin:0 0 18px;font-size:22px;letter-spacing:-.02em}
form{display:flex;gap:8px}
input[type=text]{flex:1;height:38px;padding:0 12px;border:1px solid #d4d4d8;background:#fafafa;font:inherit}
input[type=text]:focus{outline:none;border-color:#ff5401;background:#fff}
.add{height:38px;padding:0 16px;border:0;background:#ff5401;color:#fff;font-family:ui-monospace,monospace;font-size:12px;text-transform:uppercase;cursor:pointer}
.tabs{display:flex;gap:1px;background:#d4d4d8;border:1px solid #d4d4d8;margin-top:16px}
.tabs button{flex:1;border:0;background:#fafafa;padding:8px;font-family:ui-monospace,monospace;font-size:11px;text-transform:uppercase;cursor:pointer;color:#52525b}
.tabs button.on{background:#fff;color:#ff5401;font-weight:600}
ul{list-style:none;padding:0;margin:14px 0 0;border-top:1px solid #e4e4e7}
li{display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid #e4e4e7;font-size:14px}
li.done span{text-decoration:line-through;color:#71717a}
li button{margin-left:auto;border:1px solid #e4e4e7;background:transparent;padding:2px 8px;font-size:11px;cursor:pointer;color:#71717a}
</style>
</head>
<body>
<div class="box">
  <div class="k">01 · Tasks</div>
  <h1>Daily Checklist</h1>
  <form id="f"><input id="in" type="text" placeholder="Add a new task…" required><button class="add">Add</button></form>
  <div class="tabs" id="tabs"><button data-f="all" class="on">All</button><button data-f="active">Active</button><button data-f="done">Completed</button></div>
  <ul id="list"></ul>
</div>
<script>
var items=[{t:"Review component layout",d:true},{t:"Wire Gemini generation endpoint",d:false},{t:"Export standalone HTML",d:false}],filter="all";
function render(){
  var ul=document.getElementById("list");ul.innerHTML="";
  items.filter(function(x){return filter==="all"||(filter==="active"?!x.d:x.d)}).forEach(function(x){
    var li=document.createElement("li");if(x.d)li.className="done";
    var cb=document.createElement("input");cb.type="checkbox";cb.checked=x.d;cb.onchange=function(){x.d=cb.checked;render()};
    var sp=document.createElement("span");sp.textContent=x.t;
    var rm=document.createElement("button");rm.textContent="Remove";rm.onclick=function(){items=items.filter(function(i){return i!==x});render()};
    li.append(cb,sp,rm);ul.appendChild(li);
  });
}
document.getElementById("f").onsubmit=function(e){e.preventDefault();var v=document.getElementById("in");if(v.value.trim()){items.unshift({t:v.value.trim(),d:false});v.value="";render()}};
document.getElementById("tabs").onclick=function(e){var b=e.target.closest("button");if(!b)return;filter=b.dataset.f;document.querySelectorAll("#tabs button").forEach(function(x){x.classList.toggle("on",x===b)});render()};
render();
</script>
</body>
</html>`,
  },
  {
    id: "coffee-landing",
    title: "Coffee landing page",
    description: "Single-origin roastery storefront",
    prompt: "Build a refined landing page for an independent specialty coffee roastery with roast notes and subscription tiers",
    hue: 28,
    slug: "roast-atelier",
    previewHtml: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kiln &amp; Bean Roastery</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f6f6f6;color:#09090b}
header{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-bottom:1px solid #d4d4d8;background:#fff}
.brand{font-weight:700;letter-spacing:-.02em}
.tag{font-family:ui-monospace,monospace;font-size:11px;text-transform:uppercase;color:#ff5401}
.hero{padding:48px 24px;border-bottom:1px solid #d4d4d8;background:#fff}
.hero h1{margin:8px 0 12px;font-size:34px;line-height:1.05;letter-spacing:-.03em;max-width:460px}
.hero p{margin:0 0 20px;color:#52525b;max-width:440px;font-size:15px;line-height:1.5}
.btn{display:inline-block;background:#ff5401;color:#fff;padding:10px 18px;font-family:ui-monospace,monospace;font-size:12px;text-transform:uppercase;border:0;cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1px;background:#d4d4d8;border-bottom:1px solid #d4d4d8}
.card{background:#fafafa;padding:20px}
.card h3{margin:8px 0 4px;font-size:15px}
.card p{margin:0;font-size:13px;color:#52525b}
</style>
</head>
<body>
<header><span class="brand">Kiln &amp; Bean</span><span class="tag">Small-batch roasts</span></header>
<section class="hero">
  <div class="tag">Harvest 2026 · Ethiopia &amp; Colombia</div>
  <h1>Roasted daily for clean pour-overs.</h1>
  <p>Single-origin lots shipped within 24 hours of roasting, dialed in for filter and espresso.</p>
  <button class="btn" onclick="this.textContent='Added Starter Box'">Order tasting box — $24</button>
</section>
<section class="grid">
  <div class="card"><div class="tag">01 · Washed</div><h3>Yirgacheffe Worka</h3><p>Bergamot, white peach, jasmine finish.</p></div>
  <div class="card"><div class="tag">02 · Honey</div><h3>Huila El Paraíso</h3><p>Caramelized fig, cacao nib, silky body.</p></div>
  <div class="card"><div class="tag">03 · Espresso</div><h3>House Foundry</h3><p>Roasted hazelnut, dark chocolate, crema.</p></div>
</section>
</body>
</html>`,
  },
  {
    id: "photo-portfolio",
    title: "Photo portfolio",
    description: "Editorial gallery and bio",
    prompt: "Build a minimal portfolio site for an architectural photographer with a filterable gallery and contact form",
    hue: 265,
    slug: "soren-lens",
    previewHtml: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Soren Lind — Architecture</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#09090b;padding:28px 24px}
.top{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #d4d4d8;padding-bottom:14px;margin-bottom:22px}
.k{font-family:ui-monospace,monospace;font-size:11px;text-transform:uppercase;color:#ff5401}
h1{margin:0;font-size:20px;letter-spacing:-.02em}
.filters{display:flex;gap:8px;margin-bottom:18px}
.filters button{border:1px solid #d4d4d8;background:#fafafa;padding:6px 12px;font-family:ui-monospace,monospace;font-size:11px;text-transform:uppercase;cursor:pointer}
.filters button.on{background:#ff5401;color:#fff;border-color:#ff5401}
.gal{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.item{border:1px solid #d4d4d8;padding:12px;background:#fafafa}
.art{aspect-ratio:4/3;background:linear-gradient(135deg,#18181b,#52525b);margin-bottom:10px}
.item b{display:block;font-size:13px}
.item span{font-size:12px;color:#71717a}
</style>
</head>
<body>
<div class="top"><h1>Soren Lind Studio</h1><span class="k">Zurich · Tokyo</span></div>
<div class="filters" id="fl"><button class="on" data-c="all">All</button><button data-c="civic">Civic</button><button data-c="interior">Interior</button></div>
<div class="gal" id="g"></div>
<script>
var shots=[{t:"Kunsthalle Pavilion",c:"civic",y:"2026"},{t:"Kyoto Timber House",c:"interior",y:"2025"},{t:"Nordic Concrete Pier",c:"civic",y:"2025"},{t:"Atelier Stairwell",c:"interior",y:"2026"}];
function draw(cat){
  var g=document.getElementById("g");g.innerHTML="";
  shots.filter(function(s){return cat==="all"||s.c===cat}).forEach(function(s,i){
    g.innerHTML+='<div class="item"><div class="art" style="opacity:'+(0.75+i*0.06)+'"></div><b>'+s.t+'</b><span>'+s.c.toUpperCase()+' · '+s.y+'</span></div>';
  });
}
document.getElementById("fl").onclick=function(e){var b=e.target.closest("button");if(!b)return;document.querySelectorAll("#fl button").forEach(function(x){x.classList.toggle("on",x===b)});draw(b.dataset.c)};
draw("all");
</script>
</body>
</html>`,
  },
  {
    id: "pricing-page",
    title: "Pricing page",
    description: "Tier matrix with billing toggle",
    prompt: "Build a clear SaaS pricing page with a monthly and annual billing toggle and feature comparison table",
    hue: 155,
    slug: "saas-pricing",
    previewHtml: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pricing</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f6f6f6;color:#09090b;padding:32px 20px}
.head{text-align:center;margin-bottom:24px}
h1{margin:0 0 8px;font-size:28px;letter-spacing:-.03em}
.tog{display:inline-flex;border:1px solid #d4d4d8;background:#fff;padding:2px;margin-top:10px}
.tog button{border:0;background:transparent;padding:6px 14px;font-family:ui-monospace,monospace;font-size:11px;text-transform:uppercase;cursor:pointer}
.tog button.on{background:#ff5401;color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:1px;background:#d4d4d8;border:1px solid #d4d4d8;max-width:680px;margin:0 auto}
.tier{background:#fff;padding:22px;display:flex;flex-direction:column;gap:10px}
.price{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums}
.price small{font-size:12px;font-weight:400;color:#71717a}
ul{margin:0;padding-left:16px;font-size:13px;color:#52525b;line-height:1.7;flex:1}
.cta{border:1px solid #09090b;background:#09090b;color:#fff;padding:9px;font-family:ui-monospace,monospace;font-size:11px;text-transform:uppercase;cursor:pointer}
.cta.pri{background:#ff5401;border-color:#ff5401}
</style>
</head>
<body>
<div class="head">
  <h1>Predictable team plans</h1>
  <div class="tog" id="tog"><button class="on" data-m="1">Monthly</button><button data-m="0">Annual (Save 20%)</button></div>
</div>
<div class="grid">
  <div class="tier"><b>Starter</b><div class="price" id="p1">$19 <small>/mo</small></div><ul><li>Up to 3 seats</li><li>100k monthly events</li><li>Email support</li></ul><button class="cta">Start free</button></div>
  <div class="tier"><b>Growth</b><div class="price" id="p2">$49 <small>/mo</small></div><ul><li>Unlimited seats</li><li>2M monthly events</li><li>Priority SLA</li></ul><button class="cta pri">Upgrade now</button></div>
</div>
<script>
document.getElementById("tog").onclick=function(e){var b=e.target.closest("button");if(!b)return;var m=b.dataset.m==="1";document.querySelectorAll("#tog button").forEach(function(x){x.classList.toggle("on",x===b)});document.getElementById("p1").innerHTML=(m?"$19":"$15")+" <small>/mo</small>";document.getElementById("p2").innerHTML=(m?"$49":"$39")+" <small>/mo</small>"};
</script>
</body>
</html>`,
  },
  {
    id: "habit-tracker",
    title: "Habit tracker",
    description: "Daily check-ins with streak grid",
    prompt: "Build a habit tracker with daily check-ins, a 7-day completion matrix, and streak counters",
    hue: 340,
    slug: "habit-streak",
    previewHtml: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Habit Streak</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f6f6f6;color:#09090b;padding:32px 16px}
.wrap{max-width:540px;margin:0 auto;background:#fff;border:1px solid #d4d4d8;padding:22px}
.k{font-family:ui-monospace,monospace;font-size:11px;text-transform:uppercase;color:#ff5401}
h1{margin:4px 0 18px;font-size:22px;letter-spacing:-.02em}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #e4e4e7;padding:8px;text-align:center}
th:first-child,td:first-child{text-align:left;font-weight:500}
.cell{width:22px;height:22px;border:1px solid #d4d4d8;background:#fafafa;cursor:pointer;display:inline-block}
.cell.on{background:#ff5401;border-color:#ff5401}
</style>
</head>
<body>
<div class="wrap">
  <div class="k">Weekly Matrix</div>
  <h1>Habit Streaks</h1>
  <table><thead><tr><th>Habit</th><th>M</th><th>T</th><th>W</th><th>T</th><th>F</th><th>S</th><th>S</th></tr></thead><tbody id="tb"></tbody></table>
</div>
<script>
var rows=[{n:"Morning run",d:[1,1,0,1,1,0,0]},{n:"Read 20 pages",d:[1,1,1,1,0,1,0]},{n:"Deep work 2h",d:[1,0,1,1,1,0,0]}];
function draw(){
  var tb=document.getElementById("tb");tb.innerHTML="";
  rows.forEach(function(r){
    var tr=document.createElement("tr");
    var td0=document.createElement("td");td0.textContent=r.n;tr.appendChild(td0);
    r.d.forEach(function(v,idx){
      var td=document.createElement("td"),b=document.createElement("button");
      b.className="cell"+(v?" on":"");b.onclick=function(){r.d[idx]=r.d[idx]?0:1;draw()};
      td.appendChild(b);tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}
draw();
</script>
</body>
</html>`,
  },
];
