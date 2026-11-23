// Only the bot can issue passes; static Pages verifies them without an API request.
const PUBLIC_KEY = {"kty": "RSA", "n": "ouUciOjCL-zCNpdbHpZcGb5etqSmdWEMvWZNN052-MVVDRGftNMr_0R6eBEUxKKotJNQY5Dg49jrMdXTph4h9suTW0ubx5VxIaSiId_Ov7nDi6JbvXdfHVdyEnrONL4mhJPfOGBwIvA_6d8HAEVdGZpNReXSeWVI5gvBO_DzpOA6limfNlTqgnSVE0yAEolRrHxCYOVOPCLUVaxw3o3M-0zLCSaRtjnjHNUkI9k2HDGj9uqdSf3k1f4JE8xPJgOyxggvKXdhMhAdk79cOJU-PNTDQaVkjee4h8z7bCiBrKYPF3C2RHInY8lH2GFsXbErJb4exWWYJKGcFx6uIn2CCQ", "e": "AQAB", "alg": "RS256", "ext": true};
const token = new URLSearchParams(location.search).get("access") || "";
const decode = text => Uint8Array.from(atob(text.replace(/-/g,"+").replace(/_/g,"/") + "=".repeat((4-text.length%4)%4)), c=>c.charCodeAt(0));
let claims;
try { claims = JSON.parse(new TextDecoder().decode(decode(token.split(".")[1]))); } catch (_) {}
function endpoint(value) {
  try { const u=new URL(value); return u.protocol === "https:" && !u.username && !u.password && u.pathname === "/" ? u.origin : ""; }
  catch (_) { return ""; }
}
export const API_BASE = endpoint(claims?.api);
export async function checkPlayerAccess() {
  if (!token) return {allowed:false, reason:"telegram"};
  try {
    const [head,body,signature,...extra] = token.split(".");
    if (extra.length || !signature || token.length>8192) throw Error("invalid pass");
    const header=JSON.parse(new TextDecoder().decode(decode(head)));
    if(header.alg!=="RS256" || header.typ!=="JWT") throw Error("algorithm");
    const key = await crypto.subtle.importKey("jwk", PUBLIC_KEY,
      {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode(signature),new TextEncoder().encode(head+"."+body))) throw Error("signature");
    const now=Date.now()/1000;
    if(claims.iss!=="pr1zrak-sound" || claims.aud!=="player" || !Number.isSafeInteger(claims.sub) || claims.sub<=0 ||
       !Number.isFinite(claims.iat) || !Number.isFinite(claims.exp) || claims.exp-claims.iat>86400 || now<claims.iat-30) throw Error("claims");
    if(now>=claims.exp) return {allowed:false,reason:"expired"};
    const uid=window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if(uid && uid!==claims.sub) return {allowed:false,reason:"telegram"};
    return {allowed:claims.allowed===true,reason:claims.allowed===true?"allowed":"vip"};
  } catch (_) { return {allowed:false,reason:"telegram"}; }
}
export function playerHeaders() { return {Authorization:"Bearer "+token}; }
export function fetchPlayerAudio(url) {
  const protectedAudio=API_BASE && url.startsWith(API_BASE+"/api/");
  return fetch(url,protectedAudio?{headers:playerHeaders(),cache:"no-store"}:{});
}
