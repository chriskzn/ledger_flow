import http from 'node:http';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {createPool} from 'mysql2/promise';
import {ApiError,createInvoice,postManualJournal,receivePayment} from './domain.mjs';

const env=(k)=>{if(!process.env[k])throw Error(`Missing ${k}`);return process.env[k];};
const pool=createPool({host:env('DB_HOST'),port:Number(process.env.DB_PORT||3306),user:env('DB_USER'),password:env('DB_PASSWORD'),database:env('DB_NAME'),connectionLimit:10,decimalNumbers:false,multipleStatements:false,timezone:'Z',ssl:process.env.DB_SSL_CA?{ca:process.env.DB_SSL_CA.replace(/\\n/g,'\n'),rejectUnauthorized:true}:undefined});
const origin=env('APP_ORIGIN');
async function identity(req){
 const token=req.headers.authorization?.match(/^Bearer (lf_[a-f0-9]{64})$/)?.[1];
 if(!token)throw new ApiError(401,'Bearer token required');
 const prefix=token.slice(0,11), hash=createHash('sha256').update(token).digest('hex');
 const [keys]=await pool.execute(`SELECT user_id,key_hash,permissions FROM api_keys WHERE key_prefix=? AND is_active=1 AND (expires_at IS NULL OR expires_at>UTC_TIMESTAMP())`,[prefix]);
 const match=keys.find(k=>{const stored=String(k.key_hash);return /^[a-f0-9]{64}$/.test(stored)&&timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(stored,'hex'));});
 if(!match)throw new ApiError(401,'Invalid, inactive or expired key');
 const perms=typeof match.permissions==='string'?JSON.parse(match.permissions):match.permissions;
 if(!Array.isArray(perms)||!perms.includes('write'))throw new ApiError(403,'Write permission required');
 return match.user_id;
}
function response(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));}
async function handle(req,res){
 try{
  if(req.url==='/health/live'&&req.method==='GET')return response(res,200,{status:'live'});
  if(req.url==='/health/ready'&&req.method==='GET') {await pool.query('SELECT 1');return response(res,200,{status:'ready'});}
  if(!['POST'].includes(req.method))throw new ApiError(404,'Not found');
  if(req.headers.origin&&req.headers.origin!==origin)throw new ApiError(403,'Origin not permitted');
  if(!req.headers['content-type']?.toLowerCase().startsWith('application/json'))throw new ApiError(415,'JSON required');
  const tenant=await identity(req);
  let bytes=0;const parts=[];
  for await (const chunk of req){bytes+=chunk.length;if(bytes>64000)throw new ApiError(413,'Payload too large');parts.push(chunk);}
  let body;try {body=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new ApiError(400,'Malformed JSON');}
  const op=req.headers['idempotency-key'];
  let result;
  if(req.url==='/v1/journals')result=await postManualJournal(pool,tenant,body,op);
  else if(req.url==='/v1/invoices')result=await createInvoice(pool,tenant,body,op);
  else if(/^\/v1\/invoices\/[0-9a-f-]{36}\/payments$/i.test(req.url))result=await receivePayment(pool,tenant,req.url.split('/')[3],body,op);
  else throw new ApiError(404,'Not found');
  return response(res,result.replayed?200:201,result);
 }catch(e){
   // Do not disclose SQL statements, database errors, or internal identifiers.
   if(!(e instanceof ApiError))console.error('Request failure',e);
   return response(res,e instanceof ApiError?e.status:500,{error:e instanceof ApiError?e.message:'Internal error'});
 }
}
const port=Number(process.env.PORT||8080);
http.createServer((req,res)=>{void handle(req,res);}).listen(port,'127.0.0.1',()=>console.log(`LedgerFlow API bound to localhost:${port}; reverse proxy TLS required`));
