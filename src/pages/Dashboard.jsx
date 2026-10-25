import { Link } from "react-router-dom";
import { useAuth } from "../services/AuthProvider.jsx";
export default function Dashboard(){
 const {user}=useAuth();
 return <section className="mx-auto min-h-[70vh] max-w-6xl px-6 py-14"><p className="font-semibold text-brand">STUDENT DASHBOARD</p><h1 className="mt-2 text-4xl font-extrabold">Welcome{user?.displayName?", "+user.displayName.split(" ")[0]:""}!</h1><p className="mt-3 text-slate-600">Your learning journey starts here. Explore available courses and find your next skill.</p><div className="mt-9 grid gap-5 md:grid-cols-2"><div className="rounded-2xl border bg-white p-7 shadow-sm"><h2 className="text-xl font-bold">Explore courses</h2><p className="mt-2 text-slate-600">Browse the EduTech course catalog.</p><Link to="/courses" className="mt-5 inline-block rounded-lg bg-brand px-5 py-3 font-semibold text-white">Browse courses</Link></div><div className="rounded-2xl border bg-white p-7 shadow-sm"><h2 className="text-xl font-bold">My learning</h2><p className="mt-2 text-slate-600">Purchased courses and your learning progress will appear here once checkout is enabled.</p></div></div></section>
}
