import crypto from "node:crypto"; import fs from "node:fs";
for (const line of fs.readFileSync("/Users/michaelderibe/selam-live/.env","utf8").split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2];}
const T=process.env.SELAM_FB_TOKEN,S=process.env.FB_APP_SECRET,V=process.env.SELAM_FB_VIDEO;
const proof=crypto.createHmac("sha256",S).update(T).digest("hex");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const now=()=>new Date().toTimeString().slice(0,8);
let bad=0;
for(let i=0;i<240;i++){            // ~2h at 30s
  await sleep(30000);
  let j; try{ j=await (await fetch(`https://graph.facebook.com/v21.0/${V}?fields=status,live_views,ingest_streams{stream_health}&access_token=${encodeURIComponent(T)}&appsecret_proof=${proof}`)).json(); }catch(e){ console.log(`[${now()}] fetch err ${e.message}`); continue; }
  const h=j.ingest_streams&&j.ingest_streams[0]&&j.ingest_streams[0].stream_health;
  const vb=h?h.video_bitrate:0, st=j.status;
  console.log(`[${now()}] status=${st} video_bitrate=${vb} views=${j.live_views||0}`);
  if(st!=="LIVE" || !vb){ bad++; if(bad>=2){ console.log(`[${now()}] 🚨 DROP DETECTED (status=${st}, bitrate=${vb}) — broadcast ${V} is failing.`); process.exit(3); } }
  else bad=0;
}
console.log(`[${now()}] monitor window ended (still healthy).`);
