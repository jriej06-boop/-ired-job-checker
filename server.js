const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ired1234";
const DATA = path.join(__dirname, "jobs.json");

function readJobs() {
  try { return JSON.parse(fs.readFileSync(DATA, "utf8")); }
  catch { return {}; }
}
function writeJobs(jobs) {
  fs.writeFileSync(DATA, JSON.stringify(jobs, null, 2));
}
function send(res, code, data, type="application/json") {
  res.writeHead(code, {"Content-Type": type, "Cache-Control":"no-store"});
  res.end(type === "application/json" ? JSON.stringify(data) : data);
}
function body(req) {
  return new Promise((resolve,reject)=>{
    let b=""; req.on("data",c=>b+=c);
    req.on("end",()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(e)}});
  });
}
function publicJob(j) {
  if (!j) return null;
  return {...j};
}

const server = http.createServer(async (req,res)=>{
  const u = new URL(req.url, `http://${req.headers.host}`);
  const jobs = readJobs();

  try {
    if (req.method === "GET" && u.pathname === "/api/job") {
      const code = (u.searchParams.get("code")||"").trim().toUpperCase();
      return send(res, 200, {job: publicJob(jobs[code])});
    }

    if (req.method === "POST" && u.pathname === "/api/admin/login") {
      const b = await body(req);
      return send(res, b.password === ADMIN_PASSWORD ? 200 : 401,
        b.password === ADMIN_PASSWORD ? {ok:true} : {ok:false,error:"รหัสผ่านไม่ถูกต้อง"});
    }

    if (req.method === "GET" && u.pathname === "/api/admin/jobs") {
      const token = req.headers["x-admin-token"];
      if (token !== ADMIN_PASSWORD) return send(res,401,{error:"Unauthorized"});
      return send(res,200,{jobs:Object.values(jobs)});
    }

    if (req.method === "POST" && u.pathname === "/api/admin/job") {
      const token = req.headers["x-admin-token"];
      if (token !== ADMIN_PASSWORD) return send(res,401,{error:"Unauthorized"});
      const b = await body(req);
      const code = String(b.code||"").trim().toUpperCase();
      const hours = Math.max(1, Number(b.hours)||24);
      if (!code) return send(res,400,{error:"ต้องมีรหัสงาน"});
      const old = jobs[code] || {};
      const now = Date.now();
      const endAt = b.endAt ? Number(b.endAt) : (old.endAt || now + hours*3600*1000);
      jobs[code] = {
        code, type: b.type || old.type || "วิ่งลู่ + เก็บไข่",
        hours, players: b.players || old.players || "5/7",
        ping: Number(b.ping ?? old.ping ?? 40),
        speed: b.speed || old.speed || "9.02T",
        coins: b.coins || old.coins || "$663.2Qa",
        scriptOn: b.scriptOn !== undefined ? !!b.scriptOn : (old.scriptOn ?? true),
        status: b.status || old.status || "FARMING ACTIVE",
        endAt, updatedAt: now
      };
      writeJobs(jobs);
      return send(res,200,{ok:true,job:jobs[code]});
    }

    if (req.method === "DELETE" && u.pathname.startsWith("/api/admin/job/")) {
      const token = req.headers["x-admin-token"];
      if (token !== ADMIN_PASSWORD) return send(res,401,{error:"Unauthorized"});
      const code = decodeURIComponent(u.pathname.split("/").pop()).toUpperCase();
      delete jobs[code]; writeJobs(jobs);
      return send(res,200,{ok:true});
    }

    if (req.method === "GET") {
      let file = u.pathname === "/" ? "index.html" : u.pathname.slice(1);
      const fp = path.join(__dirname,"public",file);
      if (!fp.startsWith(path.join(__dirname,"public"))) return send(res,403,"Forbidden","text/plain");
      if (!fs.existsSync(fp)) return send(res,404,"Not found","text/plain");
      const ext=path.extname(fp);
      const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json"};
      return send(res,200,fs.readFileSync(fp),types[ext]||"application/octet-stream");
    }
    send(res,404,{error:"Not found"});
  } catch(e) { console.error(e); send(res,500,{error:"Server error"}); }
});
server.listen(PORT,()=>console.log(`iRED Job Checker running on http://localhost:${PORT}`));
