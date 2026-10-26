import CourseThumbnail from "../components/CourseThumbnail.jsx";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Filter, Layers3, Search, Sparkles, X } from "lucide-react";

const isTopLevel = course => !course.folderOnly && !(course.includedInCourseIds || []).length;
const formatPrice = price => Number(price) > 0 ? "₹" + Number(price).toLocaleString("en-IN") : "Free";

export default function Courses() {
 const [searchParams] = useSearchParams();
 const [courses, setCourses] = useState([]);
 const [customTracks, setCustomTracks] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [search, setSearch] = useState("");
 const [category, setCategory] = useState(searchParams.get("track") || "All");
 const [availability, setAvailability] = useState("All");

 useEffect(() => {
  let active = true;
  getDocs(query(collection(db, "courses"), where("published", "==", true)))
   .then(snapshot => { if (active) setCourses(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); })
   .catch(() => { if (active) setError("Courses could not be loaded. Please try again later."); })
   .finally(() => { if (active) setLoading(false); });
  getDocs(collection(db, "tracks")).then(snapshot => {
   if (active) setCustomTracks(snapshot.docs.map(d => d.data().name).filter(Boolean));
  }).catch(() => {});
  return () => { active = false; };
 }, []);
 useEffect(() => { setCategory(searchParams.get("track") || "All"); }, [searchParams]);

 const topLevel = useMemo(() => courses.filter(isTopLevel), [courses]);
 const categories = useMemo(() => ["All", ...new Set([...topLevel.map(c => c.track).filter(Boolean), ...customTracks])], [topLevel, customTracks]);
 const visible = useMemo(() => topLevel.filter(c => {
  const q = search.trim().toLowerCase();
  const includedTitles = (c.includedCourseIds || []).map(id => courses.find(x => x.id === id)?.title || "").join(" ");
  const matchesText = !q || [c.title, c.description, c.track, includedTitles].join(" ").toLowerCase().includes(q);
  return matchesText && (category === "All" || c.track === category) &&
   (availability === "All" || (availability === "Coming Soon" ? c.status === "comingSoon" : c.status !== "comingSoon"));
 }).sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Number(a.homeOrder ?? 999) - Number(b.homeOrder ?? 999) || (a.title || "").localeCompare(b.title || "")), [topLevel, courses, search, category, availability]);
 const canReset = search || category !== "All" || availability !== "All";
 function reset() { setSearch(""); setCategory("All"); setAvailability("All"); }

 return <div className="min-h-[80vh] bg-[#f6f8fc]">
  <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-[#102967] to-blue-800 text-white">
   <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl"/>
   <div className="pointer-events-none absolute bottom-0 left-1/4 h-44 w-96 rounded-full bg-blue-400/10 blur-3xl"/>
   <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-wide text-sky-200"><Sparkles size={15}/> EXPLORE EDUTECH</span>
    <div className="mt-5 grid gap-7 lg:grid-cols-[1fr_330px] lg:items-end">
     <div><h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">Learn skills that <span className="text-sky-300">move you forward.</span></h1><p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">Discover practical tech courses and complete learning bundles. One main-course enrollment unlocks every course included inside it.</p></div>
     <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
      <div><p className="text-3xl font-extrabold">{loading ? "—" : topLevel.length}</p><p className="mt-1 text-xs text-blue-100">Learning paths</p></div>
      <div><p className="text-3xl font-extrabold">{loading ? "—" : topLevel.filter(c => (c.includedCourseIds || []).length > 0).length}</p><p className="mt-1 text-xs text-blue-100">Complete bundles</p></div>
      <p className="col-span-2 border-t border-white/15 pt-3 text-sm text-blue-100"><CheckCircle2 size={16} className="mr-1 inline text-emerald-300"/> Structured lessons, all in one place</p>
     </div>
    </div>
   </div>
  </section>

  <div className="relative mx-auto max-w-7xl px-5 pb-20 sm:px-8">
   <div className="relative -mt-7 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/5 md:grid-cols-[minmax(0,1fr)_210px_185px]">
    <label className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
     <Search size={20} className="shrink-0 text-slate-400"/><input aria-label="Search courses" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses, skills, or modules..." className="w-full min-w-0 bg-transparent py-3.5 text-sm outline-none"/>
     {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={17} className="text-slate-400"/></button>}
    </label>
    <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-700 outline-blue-500">{categories.map(t => <option key={t} value={t}>{t === "All" ? "All categories" : t}</option>)}</select>
    <select aria-label="Availability" value={availability} onChange={e => setAvailability(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-700 outline-blue-500">{["All", "Available", "Coming Soon"].map(t => <option key={t} value={t}>{t === "All" ? "All availability" : t}</option>)}</select>
   </div>

   <div className="mb-6 mt-11 flex flex-wrap items-end justify-between gap-4">
    <div><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.17em] text-blue-700"><Filter size={15}/> Find your next course</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{canReset ? "Search results" : "All learning paths"}</h2><p className="mt-2 text-sm text-slate-500">Every main course and its included modules, clearly organized.</p></div>
    <div className="flex items-center gap-3"><span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm">{loading ? "Loading..." : visible.length + " courses"}</span>{canReset && <button type="button" onClick={reset} className="text-sm font-bold text-blue-700 hover:underline">Clear filters</button>}</div>
   </div>
   {loading ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3,4,5,6].map(i => <div key={i} className="overflow-hidden rounded-2xl border bg-white"><div className="aspect-video animate-pulse bg-slate-200"/><div className="space-y-3 p-6"><div className="h-4 w-24 animate-pulse rounded bg-slate-200"/><div className="h-7 w-3/4 animate-pulse rounded bg-slate-200"/><div className="h-12 animate-pulse rounded bg-slate-100"/></div></div>)}</div>
   : error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>
   : visible.length === 0 ? <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm"><BookOpen size={40} className="mx-auto text-slate-400"/><h3 className="mt-4 text-xl font-extrabold text-slate-900">No courses found</h3><p className="mt-2 text-slate-500">{canReset ? "Try a different search or clear your filters." : "Published courses will appear here once they are added by the administrator."}</p>{canReset && <button onClick={reset} className="mt-5 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white">Show all courses</button>}</div>
   : <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">{visible.map(c => {
    const children = (c.includedCourseIds || []).map(id => courses.find(x => x.id === id)).filter(Boolean);
    const childCount = (c.includedCourseIds || []).length;
    const isBundle = childCount > 0;
    return <article key={c.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl">
     <Link to={"/courses/" + encodeURIComponent(c.id)} aria-label={"View " + c.title} className="relative block aspect-video overflow-hidden bg-blue-950">
      <CourseThumbnail src={c.thumbnail} alt={c.title} className="transition duration-500 group-hover:scale-105"/>
      <div className="absolute left-3 top-3 flex flex-wrap gap-2">{c.status === "comingSoon" && <span className="rounded-lg bg-amber-400 px-2.5 py-1 text-[10px] font-extrabold uppercase text-slate-950">Coming soon</span>}{c.badge && <span className="rounded-lg bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-blue-900 shadow-sm">{c.badge}</span>}{c.featured && <span className="rounded-lg bg-sky-300 px-2.5 py-1 text-[10px] font-extrabold text-slate-950">Featured</span>}</div>
      {isBundle && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-950/85 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm"><Layers3 size={14}/>{childCount} included {childCount === 1 ? "course" : "courses"}</span>}
     </Link>
     <div className="flex flex-1 flex-col p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-extrabold uppercase tracking-[.13em] text-blue-700">{c.track || "Technology"}</p>{c.level && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{c.level}</span>}</div>
      <Link to={"/courses/" + encodeURIComponent(c.id)} className="mt-3"><h3 className="line-clamp-2 text-xl font-extrabold leading-snug text-slate-950 transition group-hover:text-blue-700">{c.title || "Untitled course"}</h3></Link>
      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-6 text-slate-500">{c.description || "A structured learning path with practical video lessons."}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">{c.duration && <span className="inline-flex items-center gap-1.5"><Clock3 size={14}/>{c.duration}</span>}{c.language && <span className="rounded-md bg-slate-100 px-2 py-1">{c.language}</span>}</div>
      {isBundle && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-3"><p className="flex items-center gap-2 text-xs font-extrabold text-blue-900"><Layers3 size={15}/> One enrollment, {childCount} included {childCount === 1 ? "course" : "courses"}</p><p className="mt-1.5 line-clamp-2 text-xs leading-5 text-blue-800">{children.length ? children.map(x => x.title).join(" · ") : "View the complete learning roadmap inside"}</p></div>}
      <div className="mt-auto pt-5">
       <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><div><p className="text-[11px] font-medium text-slate-500">{c.status === "comingSoon" ? "Launching soon" : "Course price"}</p><p className="mt-0.5 text-xl font-extrabold text-slate-950">{c.status === "comingSoon" ? "Coming soon" : formatPrice(c.price)}</p></div><Link to={"/courses/" + encodeURIComponent(c.id)} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-blue-800 sm:text-sm">View course <ArrowRight size={16}/></Link></div>
      </div>
     </div>
    </article>;
   })}</div>}
  </div>
 </div>;
}
