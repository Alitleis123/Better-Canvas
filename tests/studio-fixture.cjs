/* Run with node tests/studio-fixture.cjs; serves only the local synthetic fixture and extension assets. */
﻿const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const files = manifest.content_scripts[0].js.filter(f => !f.endsWith('/content.js'));
const setup = `window.auditErrors=[];window.addEventListener('error',e=>auditErrors.push(e.message));window.addEventListener('unhandledrejection',e=>auditErrors.push(String(e.reason)));
const stored={bcSettings:BC.cloneDefaults(),bcLocal:{notes:{},drafts:{},cache:{}}};
const events=[];const writes=[];window.auditWrites=writes;
window.chrome={storage:{local:{remove:(key,cb)=>{delete stored[key];queueMicrotask(()=>cb&&cb());},get:(keys,cb)=>queueMicrotask(()=>cb(structuredClone(stored))),set:(obj,cb)=>{const changes={};for(const k of Object.keys(obj)){changes[k]={oldValue:stored[k],newValue:structuredClone(obj[k])};stored[k]=structuredClone(obj[k]);}queueMicrotask(()=>{events.forEach(fn=>fn(changes,'local'));if(cb)cb();});}},onChanged:{addListener:f=>events.push(f),removeListener:f=>{const i=events.indexOf(f);if(i>=0)events.splice(i,1);}}},runtime:{id:'audit-mock',onMessage:{addListener:()=>{}},sendMessage:()=>{},getURL:s=>s}};
window.fetch=async (url,opts={})=>{if(opts.method&&opts.method!=='GET')writes.push({url,opts});return new Response(JSON.stringify([]),{status:200,headers:{'Content-Type':'application/json'}});};`;
const scripts = files.map((f,i)=>`<script src="/${f}"></script>${i===0?'<script>'+setup+'</script>':''}`).join('\n');
const fixture = fs.readFileSync(path.join(__dirname, 'studio-fixture.js'), 'utf8');
const html = '<!doctype html><meta charset="utf-8"><title>Better Canvas audit fixture</title><style>body{font-family:Arial}#right-side{width:350px}#main{width:900px}#menu{display:flex}</style><meta name="csrf-param" content="authenticity_token"><ul id="menu"></ul><div id="main"><div id="content"></div><div id="DashboardCard_Container"></div></div><aside id="right-side"><div class="Sidebar__TodoListContainer">Canvas To Do</div></aside><div id="settings"></div>'+scripts+'<script>window.auditReady=Promise.all([BC.storage.load(),BC.storage.loadLocal()]);</script><script>'+fixture+'</script>';
http.createServer((req,res)=>{const pathname=new URL(req.url,'http://127.0.0.1').pathname;if(pathname.startsWith('/src/')){const p=path.resolve(root,'.'+pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',p.endsWith('.png')?'image/png':'text/javascript; charset=utf-8');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}).listen(18766,'127.0.0.1',()=>console.log('Studio fixture: http://localhost:18766'));
