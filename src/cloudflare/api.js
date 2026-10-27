export async function api(path,options={}){
 const {body,...rest}=options;
 const response=await fetch(path,{credentials:"same-origin",...rest,headers:{
  ...(body&&!(body instanceof Blob)&&!(body instanceof File)?{"Content-Type":"application/json"}:{}),
  ...rest.headers
 },body:body&&!(body instanceof Blob)&&!(body instanceof File)?JSON.stringify(body):body});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||"Request failed ("+response.status+")");
 return data;
}
export const formatPrice=n=>Number(n)>0?"₹"+Number(n).toLocaleString("en-IN"):"Free";
export const readableDate=n=>n?new Date(n*1000).toLocaleDateString("en-IN",{year:"numeric",month:"short",day:"numeric"}):"Lifetime";
