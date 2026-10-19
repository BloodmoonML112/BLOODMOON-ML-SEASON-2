const express = require("express");
const path = require("path");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error("SECURITY ERROR: Set ADMIN_PASSWORD to a strong password of at least 12 characters.");
  process.exit(1);
}
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error("SECURITY ERROR: Set SESSION_SECRET to a random secret of at least 32 characters.");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("CONFIG ERROR: Set DATABASE_URL to your Supabase Postgres connection string.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

app.disable("x-powered-by");
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:"100kb"}));
app.use("/api/admin/login", rateLimit({windowMs:15*60*1000, max:10, standardHeaders:true, legacyHeaders:false}));
app.use(express.static(path.join(__dirname,"public")));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      team_name TEXT NOT NULL,
      captain_name TEXT NOT NULL,
      contact TEXT NOT NULL,
      facebook TEXT,
      logo_url TEXT,
      players JSONB NOT NULL,
      accept_rules BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS registrations_created_at_idx ON registrations(created_at DESC);
  `);
}
function safeEqual(a,b){const x=Buffer.from(String(a));const y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function sign(payload){const data=Buffer.from(JSON.stringify(payload)).toString("base64url");const sig=crypto.createHmac("sha256",SESSION_SECRET).update(data).digest("base64url");return `${data}.${sig}`;}
function verify(token){try{const [data,sig]=token.split(".");const expected=crypto.createHmac("sha256",SESSION_SECRET).update(data).digest("base64url");if(!safeEqual(sig,expected))return null;const p=JSON.parse(Buffer.from(data,"base64url").toString());if(p.exp<Date.now())return null;return p;}catch{return null;}}
function adminOnly(req,res,next){const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");const session=verify(token);if(!session||session.role!=="admin")return res.status(401).json({error:"Admin session expired. Please sign in again."});next();}
function clean(v,max=250){return String(v??"").trim().slice(0,max);}
function validUrl(v){if(!v)return true;try{const u=new URL(v);return u.protocol==="https:"||u.protocol==="http:";}catch{return false;}}
function publicRow(r){return {id:r.id,teamName:r.team_name,captainName:r.captain_name,contact:r.contact,facebook:r.facebook||"",logoUrl:r.logo_url||"",players:r.players,acceptRules:r.accept_rules,status:r.status,createdAt:r.created_at,updatedAt:r.updated_at};}

app.post("/api/registrations", async (req,res)=>{
  try {
    const b=req.body||{};
    const teamName=clean(b.teamName,60),captainName=clean(b.captainName,60),contact=clean(b.contact,25);
    if(!teamName||!captainName||!contact)return res.status(400).json({error:"Team name, captain name, and contact number are required."});
    if(!Array.isArray(b.players))return res.status(400).json({error:"Player roster is required."});
    const players=b.players.map(p=>({role:clean(p.role,40),name:clean(p.name,60),gameId:clean(p.gameId,40)}));
    const mains=players.filter(p=>p.role.startsWith("Main Player"));
    const subs=players.filter(p=>p.role.startsWith("Substitute"));
    if(mains.length!==5||mains.some(p=>!p.name||!p.gameId))return res.status(400).json({error:"Please complete all 5 main players with names and Game IDs."});
    if(players.length>7||subs.length>2)return res.status(400).json({error:"A team may have at most 5 main players and 2 substitutes."});
    if(subs.some(p=>!p.name||!p.gameId))return res.status(400).json({error:"Complete both name and Game ID for each substitute you add."});
    if(!validUrl(clean(b.facebook,250))||!validUrl(clean(b.logoUrl,500)))return res.status(400).json({error:"Facebook and logo links must be valid URLs."});
    if(b.acceptRules!==true)return res.status(400).json({error:"You must accept the tournament rules."});
    const duplicate=await pool.query("SELECT id FROM registrations WHERE LOWER(team_name)=LOWER($1) AND status <> 'Rejected' LIMIT 1",[teamName]);
    if(duplicate.rowCount)return res.status(409).json({error:"A registration for this team name already exists. Contact management if you need help."});
    const id="BM2-"+crypto.randomBytes(4).toString("hex").toUpperCase();
    await pool.query(
      "INSERT INTO registrations (id,team_name,captain_name,contact,facebook,logo_url,players,accept_rules,status) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'Pending')",
      [id,teamName,captainName,contact,clean(b.facebook,250),clean(b.logoUrl,500),JSON.stringify(players),true]
    );
    res.status(201).json({ok:true,id,status:"Pending"});
  } catch(err) {
    console.error("Registration error:",err.message);
    res.status(500).json({error:"Registration could not be saved right now. Please try again."});
  }
});

app.post("/api/admin/login",(req,res)=>{
  const {username,password}=req.body||{};
  if(!safeEqual(clean(username,100),ADMIN_USER)||!safeEqual(String(password||""),ADMIN_PASSWORD))return res.status(401).json({error:"Invalid username or password."});
  const token=sign({role:"admin",exp:Date.now()+8*60*60*1000});
  res.json({token,expiresInSeconds:28800});
});
app.get("/api/admin/registrations",adminOnly,async(req,res)=>{
  try{const r=await pool.query("SELECT * FROM registrations ORDER BY created_at DESC");res.json(r.rows.map(publicRow));}
  catch(err){console.error(err.message);res.status(500).json({error:"Could not load registrations."});}
});
app.patch("/api/admin/registrations/:id",adminOnly,async(req,res)=>{
  const status=clean(req.body?.status,20);
  if(!["Pending","Approved","Rejected"].includes(status))return res.status(400).json({error:"Invalid status."});
  try{
    const r=await pool.query("UPDATE registrations SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *",[status,req.params.id]);
    if(!r.rowCount)return res.status(404).json({error:"Registration not found."});
    res.json({ok:true,registration:publicRow(r.rows[0])});
  }catch(err){console.error(err.message);res.status(500).json({error:"Could not update registration."});}
});
app.delete("/api/admin/registrations/:id",adminOnly,async(req,res)=>{
  try{const r=await pool.query("DELETE FROM registrations WHERE id=$1 RETURNING id",[req.params.id]);if(!r.rowCount)return res.status(404).json({error:"Registration not found."});res.json({ok:true});}
  catch(err){console.error(err.message);res.status(500).json({error:"Could not delete registration."});}
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

initDb().then(()=>{
  app.listen(PORT,"0.0.0.0",()=>console.log(`Blood Moon ML Season 2 website running on port ${PORT}`));
}).catch(err=>{
  console.error("Database initialization failed:",err.message);
  process.exit(1);
});
