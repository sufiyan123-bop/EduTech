import {optionalUser,publicUser,json,errorResponse} from "../../_lib/core.js";
export async function onRequestGet(ctx){
 try{const user=await optionalUser(ctx);return json({user:user?publicUser(user):null})}
 catch(e){return errorResponse(e)}
}
