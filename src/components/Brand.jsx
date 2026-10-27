import React from "react";

/** Shared InfraRivet Academy identity used by the legacy and Cloudflare frontends. */
export default function Brand({inverse=false,compact=false}) {
 return <span className="inline-flex min-w-0 items-center gap-2.5" aria-label="InfraRivet Academy">
  <span className="relative inline-block h-11 w-12 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60">
   <img src="/infrarivet-logo.svg" alt="" aria-hidden="true" width="96" height="96" className="absolute -top-[11px] left-1/2 h-24 w-24 max-w-none -translate-x-1/2" />
  </span>
  {!compact&&<span className="inline-flex min-w-0 flex-col leading-none">
   <span className={"whitespace-nowrap text-[17px] font-black tracking-tight sm:text-xl "+(inverse?"text-white":"text-slate-950")}>Infra<span className="text-[#bb842b]">Rivet</span></span>
   <span className={"mt-1 text-[9px] font-extrabold tracking-[.27em] "+(inverse?"text-slate-300":"text-slate-600")}>ACADEMY</span>
  </span>}
 </span>;
}

export function BrandFull({className=""}) {
 return <img src="/infrarivet-logo.svg" width="240" height="240" alt="InfraRivet Academy — Build. Automate. Deploy." className={className} loading="lazy" decoding="async"/>;
}
