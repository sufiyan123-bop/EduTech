import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
const AuthContext=createContext({user:null,loading:true});
export function AuthProvider({children}){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
 useEffect(()=>onAuthStateChanged(auth,next=>{setUser(next);setLoading(false)}),[]);
 return <AuthContext.Provider value={{user,loading}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
