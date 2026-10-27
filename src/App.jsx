import Brand from "./components/Brand.jsx";
import {Link,Navigate,Route,Routes} from "react-router-dom";
import {Menu} from "lucide-react";
import {useState} from "react";
import {useAuth,Login} from "./cloudflare/Auth.jsx";
import {Home,Courses,CourseDetails} from "./cloudflare/Catalog.jsx";
import Dashboard from "./cloudflare/Dashboard.jsx";
import {Study} from "./cloudflare/Study.jsx";
import Admin from "./cloudflare/Admin.jsx";
function Protected({children,admin=false}){
 const {user,loading}=useAuth();
 if(loading)return <div className="mx-auto max-w-4xl px-6 py-24 text-center">Loading…</div>;
 if(!user)return <Navigate to="/login" replace/>;
 if(admin&&!user.role)return <Navigate to="/dashboard" replace/>;
 return children;
}
export default function App(){
 const {user,loading,signOut}=useAuth(),[menu,setMenu]=useState(false);
 return <div className="min-h-screen"><header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur"><nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4"><Link className="inline-flex items-center gap-2 text-xl font-black tracking-tight text-blue-900 sm:text-2xl" to="/"><Brand/></Link><button className="rounded-lg border p-2 md:hidden" onClick={()=>setMenu(v=>!v)} aria-label="Toggle navigation"><Menu size={21}/></button><div className={"items-center gap-5 text-sm font-bold md:flex "+(menu?"flex flex-wrap":"hidden")}><Link onClick={()=>setMenu(false)} to="/courses" className="text-slate-700 hover:text-blue-700">Courses</Link>{!loading&&(user?<><Link to="/dashboard" onClick={()=>setMenu(false)} className="text-slate-700 hover:text-blue-700">Dashboard</Link>{user.role&&<Link to="/admin" className="text-blue-700" onClick={()=>setMenu(false)}>Admin</Link>}<button onClick={()=>signOut().catch(()=>{})} className="rounded-xl bg-slate-900 px-4 py-2.5 text-white">Sign out</button></>:<><Link to="/signup" onClick={()=>setMenu(false)} className="text-blue-700">Sign up</Link><Link to="/login" onClick={()=>setMenu(false)} className="rounded-xl bg-blue-700 px-4 py-2.5 text-white">Sign in</Link></>)}</div></nav></header><main><Routes><Route path="/" element={<Home/>}/><Route path="/courses" element={<Courses/>}/><Route path="/courses/:courseId" element={<CourseDetails/>}/><Route path="/login" element={user?<Navigate to="/dashboard" replace/>:<Login/>}/><Route path="/signup" element={user?<Navigate to="/dashboard" replace/>:<Login signup/>}/><Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/><Route path="/learn/:courseId" element={<Protected><Study/></Protected>}/><Route path="/admin" element={<Protected admin><Admin/></Protected>}/><Route path="*" element={<div className="mx-auto max-w-3xl px-5 py-24 text-center"><h1 className="text-4xl font-extrabold">Page not found</h1><Link className="mt-5 inline-block text-blue-700 underline" to="/">Back to InfraRivet Academy</Link></div>}/></Routes></main><footer className="bg-slate-950 px-5 py-12 text-center text-sm text-slate-300"><span className="mx-auto mb-3 inline-flex justify-center"><Brand inverse/></span><span className="block">© {new Date().getFullYear()} InfraRivet Academy · Build. Automate. Deploy.</span></footer></div>;
}
