const enc=new TextEncoder();
const ITERATIONS=210000;
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
const unhex=s=>new Uint8Array(s.match(/../g).map(x=>parseInt(x,16)));
const random=(n=32)=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return hex(b)};
const hash=async s=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s))));
async function digest(p,s,n=ITERATIONS){const k=await crypto.subtle.importKey("raw",enc.encode(p),"PBKDF2",false,["deriveBits"]);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:unhex(s),iterations:n,hash:"SHA-256"},k,256)))}
function equal(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0}
export async function createCredentials(db,id,password){const salt=random(16);await db.prepare("INSERT INTO credentials(user_id,password_salt,password_hash,password_iterations) VALUES(?,?,?,?)").bind(id,salt,await digest(password,salt),ITERATIONS).run()}
export async function verifyCredentials(db,id,password){const row=await db.prepare("SELECT password_salt,password_hash,password_iterations FROM credentials WHERE user_id=?").bind(id).first();if(!row){await digest(password,"0".repeat(32));return false}return equal(await digest(password,row.password_salt,row.password_iterations),row.password_hash)}
const COOKIE="edutech_session";
const opt=(r,age)=>`Path=/; HttpOnly; SameSite=Lax${new URL(r.url).protocol==="https:"?"; Secure":""}; Max-Age=${age}`;
const getToken=r=>(r.headers.get("Cookie")||"").split(";").map(s=>s.trim()).find(s=>s.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);
export async function issueSession(db,r,id){const token=random(),ttl=604800;await db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await hash(token),id,Math.floor(Date.now()/1000)+ttl).run();return `${COOKIE}=${token}; ${opt(r,ttl)}`}
export async function getSession(env,r){const t=getToken(r);if(!t||!/^[a-f0-9]{64}$/.test(t))return null;return env.DB.prepare("SELECT u.id,u.email,u.display_name AS displayName,u.trial_expires_at AS trialExpiresAt FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>unixepoch()").bind(await hash(t)).first()}
export async function revokeSession(env,r){const t=getToken(r);if(t&&/^[a-f0-9]{64}$/.test(t))await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hash(t)).run();return `${COOKIE}=; ${opt(r,0)}`}
export async function requireUser(env,r){const u=await getSession(env,r);if(!u)throw Object.assign(Error("Sign in required"),{status:401});return u}
export async function requirePermission(env,r,p){const u=await requireUser(env,r);if(env.OWNER_USER_ID&&u.id===env.OWNER_USER_ID)return {...u,isOwner:true};const row=await env.DB.prepare("SELECT permissions_json,active FROM staff WHERE user_id=?").bind(u.id).first();let permissions=[];try{permissions=JSON.parse(row?.permissions_json||"[]")}catch{}if(row?.active!==1||!permissions.includes(p))throw Object.assign(Error("Not authorized"),{status:403});return u}
export function assertSameOrigin(r){const o=r.headers.get("Origin");if(!o||o!==new URL(r.url).origin)throw Object.assign(Error("Invalid request origin"),{status:403})}
export function respondError(e){const s=Number(e?.status)||500;return noStore({error:s===500?"Service unavailable":e.message},s)}
export function noStore(data,status=200,headers={}){return Response.json(data,{status,headers:{"Cache-Control":"no-store",...headers}})}
export const validatePassword=p=>typeof p==="string"&&p.length>=12&&p.length<=256;
