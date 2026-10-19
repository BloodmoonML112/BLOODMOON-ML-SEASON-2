const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const playersContainer = $("#playersContainer");
const roles = ["Main Player 1","Main Player 2","Main Player 3","Main Player 4","Main Player 5","Substitute 1 (optional)","Substitute 2 (optional)"];
playersContainer.innerHTML = roles.map((role,i)=>`<div class="player-row"><div class="player-role">${role}</div><label>Player name ${i<5?"*":"(optional)"}<input name="playerName${i+1}" maxlength="60" ${i<5?"required":""} placeholder="Player name"></label><label>Game ID ${i<5?"*":"(optional)"}<input name="playerId${i+1}" maxlength="40" ${i<5?"required":""} placeholder="MLBB ID / IGN"></label></div>`).join("");
$("#year").textContent = new Date().getFullYear();
$("#menuBtn").addEventListener("click",()=>$("#navLinks").classList.toggle("open"));
$$('#navLinks a').forEach(a=>a.addEventListener("click",()=>$("#navLinks").classList.remove("open")));

const form = $("#registrationForm");
form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const msg=$("#formMessage"); msg.className="form-message"; msg.textContent="Submitting registration…";
  const fd=new FormData(form);
  const payload={
    teamName:fd.get("teamName").trim(), captainName:fd.get("captainName").trim(),
    contact:fd.get("contact").trim(), facebook:fd.get("facebook").trim(),
    logoUrl:fd.get("logoUrl").trim(),
    players:roles.map((role,i)=>({role,name:(fd.get(`playerName${i+1}`)||"").trim(),gameId:(fd.get(`playerId${i+1}`)||"").trim()})).filter((p,i)=>i<5||(p.name&&p.gameId)),
    acceptRules:fd.get("acceptRules")==="on"
  };
  try {
    const r=await fetch("/api/registrations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||"Could not submit registration.");
    msg.className="form-message success";msg.textContent=`Registration submitted successfully! Your reference ID is ${data.id}. Save it for your records.`;
    form.reset(); window.location.hash="register";
  } catch(err) {
    msg.className="form-message";msg.textContent=err.message||"Unable to submit. Please try again.";
  }
});

const modal=$("#adminModal");
$("#adminOpen").addEventListener("click",()=>{modal.hidden=false;document.body.style.overflow="hidden";});
$("#adminClose").addEventListener("click",closeModal);
modal.addEventListener("click",e=>{if(e.target===modal)closeModal();});
function closeModal(){modal.hidden=true;document.body.style.overflow="";}
let adminToken=sessionStorage.getItem("bm_admin_token")||"";
$("#adminLoginForm").addEventListener("submit",async e=>{
  e.preventDefault(); const fd=new FormData(e.currentTarget);
  $("#loginMessage").textContent="Signing in…";
  try{
    const r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:fd.get("username"),password:fd.get("password")})});
    const d=await r.json();if(!r.ok)throw new Error(d.error||"Login failed");
    adminToken=d.token;sessionStorage.setItem("bm_admin_token",adminToken);
    $("#adminLoginView").hidden=true;$("#adminDashboard").hidden=false;$("#loginMessage").textContent="";await loadRegistrations();
  }catch(err){$("#loginMessage").textContent=err.message;}
});
$("#adminLogout").addEventListener("click",()=>{adminToken="";sessionStorage.removeItem("bm_admin_token");$("#adminDashboard").hidden=true;$("#adminLoginView").hidden=false;$("#adminLoginForm").reset();});
async function apiAdmin(path,options={}) {
  const r=await fetch(path,{...options,headers:{"Content-Type":"application/json","Authorization":`Bearer ${adminToken}`,...options.headers}});
  const d=await r.json();if(!r.ok){if(r.status===401){adminToken="";sessionStorage.removeItem("bm_admin_token");$("#adminDashboard").hidden=true;$("#adminLoginView").hidden=false;}throw new Error(d.error||"Request failed");}return d;
}
let allRegistrations=[];
async function loadRegistrations(){
  try{allRegistrations=await apiAdmin("/api/admin/registrations");renderAdmin();}
  catch(err){$("#registrationsList").innerHTML=`<div class="empty-state">${escapeHtml(err.message)}</div>`;}
}
function renderAdmin(){
  const pending=allRegistrations.filter(x=>x.status==="Pending").length,approved=allRegistrations.filter(x=>x.status==="Approved").length;
  $("#adminSummary").innerHTML=`<div class="summary-card"><strong>${allRegistrations.length}</strong><span>TOTAL TEAMS</span></div><div class="summary-card"><strong>${pending}</strong><span>PENDING</span></div><div class="summary-card"><strong>${approved}</strong><span>APPROVED</span></div>`;
  const q=$("#adminSearch").value.toLowerCase(),status=$("#statusFilter").value;
  const filtered=allRegistrations.filter(x=>(!status||x.status===status)&&(`${x.teamName} ${x.captainName} ${x.contact}`.toLowerCase().includes(q)));
  $("#registrationsList").innerHTML=filtered.length?filtered.map(x=>`<article class="registration-item"><div class="registration-item-head"><div><h3>${escapeHtml(x.teamName)}</h3><small>Ref: ${escapeHtml(x.id)} • Submitted ${new Date(x.createdAt).toLocaleString()}</small></div><span class="status-pill ${escapeHtml(x.status)}">${escapeHtml(x.status)}</span></div><p><b>Captain:</b> ${escapeHtml(x.captainName)} &nbsp; <b>Contact:</b> ${escapeHtml(x.contact)}</p><p><b>Players:</b> ${x.players.map(p=>`${escapeHtml(p.role)}: ${escapeHtml(p.name)} (${escapeHtml(p.gameId)})`).join(" • ")}</p>${x.facebook?`<p><b>Facebook:</b> ${escapeHtml(x.facebook)}</p>`:""}<div class="registration-actions"><button data-status="Approved" data-id="${escapeHtml(x.id)}">Approve</button><button data-status="Rejected" data-id="${escapeHtml(x.id)}">Reject</button><button data-status="Pending" data-id="${escapeHtml(x.id)}">Mark Pending</button><button class="danger" data-delete="${escapeHtml(x.id)}">Delete</button></div></article>`).join(""):`<div class="empty-state">No registrations match your search.</div>`;
  $$("#registrationsList [data-status]").forEach(b=>b.addEventListener("click",async()=>{try{await apiAdmin(`/api/admin/registrations/${encodeURIComponent(b.dataset.id)}`,{method:"PATCH",body:JSON.stringify({status:b.dataset.status})});await loadRegistrations();}catch(e){alert(e.message);}}));
  $$("#registrationsList [data-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Delete this registration permanently?"))return;try{await apiAdmin(`/api/admin/registrations/${encodeURIComponent(b.dataset.delete)}`,{method:"DELETE"});await loadRegistrations();}catch(e){alert(e.message);}}));
}
$("#adminSearch").addEventListener("input",renderAdmin);$("#statusFilter").addEventListener("change",renderAdmin);
$("#exportCsv").addEventListener("click",()=>{
  const rows=[["Reference","Status","Team","Captain","Contact","Facebook","Player Role","Player Name","Game ID","Submitted"]];
  allRegistrations.forEach(x=>x.players.forEach(p=>rows.push([x.id,x.status,x.teamName,x.captainName,x.contact,x.facebook||"",p.role,p.name,p.gameId,x.createdAt])));
  const csv=rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="blood-moon-registrations.csv";a.click();URL.revokeObjectURL(url);
});
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
if(adminToken){$("#adminOpen").textContent="Admin • Signed In";}
