import {randomUUID} from 'node:crypto';
export class ApiError extends Error { constructor(status, message) { super(message); this.status=status; } }
export const uuid = randomUUID;
export function amount(value, allowZero=false) {
  const s=String(value);
  if (!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(s)) throw new ApiError(422,'Invalid money amount');
  const [whole, fraction='']=s.split('.');
  const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(n) || (allowZero ? n<0 : n<=0)) throw new ApiError(422,'Invalid money amount');
  return n;
}
export const asDecimal = cents => `${Math.floor(cents/100)}.${String(cents%100).padStart(2,'0')}`;
export function dateOnly(s) {
  if(typeof s!=='string'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(s)) throw new ApiError(422,'Invalid date');
  const d=new Date(s+'T00:00:00Z');
  if (Number.isNaN(+d)||d.toISOString().slice(0,10)!==s) throw new ApiError(422,'Invalid date');
  return s;
}
export function key(s){ if(typeof s!=='string'|| !/^[A-Za-z0-9_-]{12,128}$/.test(s)) throw new ApiError(422,'Idempotency-Key required (12–128 safe characters)');return s; }
export function validUuid(v){if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))throw new ApiError(422,'Invalid UUID'); return v;}
export function memo(v){if(typeof v!=='string'||!v.trim()||v.length>500)throw new ApiError(422,'Invalid description');return v.trim();}
export async function tx(pool, work) {const c=await pool.getConnection();try {await c.beginTransaction();const result=await work(c);await c.commit();return result;}catch(e){await c.rollback();throw e;}finally{c.release();}}
async function execute(c,sql,params){const [rows]=await c.execute(sql,params);return rows;}
async function idempotent(c,tenant,op,type,id) {
  await execute(c,`INSERT IGNORE INTO operation_idempotency (user_id,operation_key,operation_type,entity_id) VALUES (?,?,?,?)`,[tenant,op,type,id]);
  const [row]=await execute(c,`SELECT operation_type,entity_id FROM operation_idempotency WHERE user_id=? AND operation_key=? FOR UPDATE`,[tenant,op]);
  if(row.operation_type!==type)throw new ApiError(409,'Idempotency key reused for another operation');
  return row.entity_id;
}
async function journal(c,tenant,{id,date,reference,description,source,sourceId,lines}) {
  if(!Array.isArray(lines)||lines.length<2||lines.length>100)throw new ApiError(422,'Journal needs 2–100 lines');
  let debit=0,credit=0;const parsed=[];
  for(const line of lines){const d=amount(line.debit??'0',true),cr=amount(line.credit??'0',true);if((d>0)===(cr>0))throw new ApiError(422,'Each line must contain either debit or credit');debit+=d;credit+=cr;parsed.push({account:validUuid(line.account_id),debit:d,credit:cr,description:line.description||null});}
  if(debit!==credit||debit===0)throw new ApiError(422,'Journal is not balanced');
  const ids=[...new Set(parsed.map(x=>x.account))];
  const placeholders=ids.map(()=>'?').join(',');
  const accounts=await execute(c,`SELECT id FROM accounts WHERE user_id=? AND is_active=1 AND id IN (${placeholders}) FOR UPDATE`,[tenant,...ids]);
  if(accounts.length!==ids.length)throw new ApiError(422,'Account missing, inactive or outside tenant');
  const yyyy=date.slice(0,4),mm=date.slice(5,7);
  await execute(c,`INSERT INTO journal_entries (id,user_id,entry_date,reference,description,period_month,period_year,status,source,source_id) VALUES (?,?,?,?,?,?,?,'posted',?,?)`,[id,tenant,date,reference||null,description,Number(mm),Number(yyyy),source,sourceId]);
  for(const x of parsed)await execute(c,`INSERT INTO journal_lines (id,user_id,journal_entry_id,account_id,debit,credit,description) VALUES (?,?,?,?,?,?,?)`,[uuid(),tenant,id,x.account,asDecimal(x.debit),asDecimal(x.credit),x.description]);
  return id;
}
async function audit(c,tenant,action,id) {await execute(c,`INSERT INTO audit_events (id,user_id,action,entity_id) VALUES (?,?,?,?)`,[uuid(),tenant,action,id]);}
export async function postManualJournal(pool,tenant,body,op){
 validUuid(tenant);const date=dateOnly(body.entry_date),description=memo(body.description),lines=body.lines;key(op);
 return tx(pool,async c=>{
 const fresh=uuid(),id=await idempotent(c,tenant,op,'manual_journal',fresh);
 if(id!==fresh)return {id,replayed:true};
 await journal(c,tenant,{id,date,reference:body.reference,description,source:'manual',sourceId:null,lines});
 await audit(c,tenant,'journal.post',id);return {id,replayed:false};
 });
}
export async function createInvoice(pool,tenant,body,op){
 validUuid(tenant);key(op);const customer=validUuid(body.customer_id),invoiceDate=dateOnly(body.invoice_date),dueDate=dateOnly(body.due_date);
 if(dueDate<invoiceDate)throw new ApiError(422,'Due date precedes invoice date');
 const number=memo(body.invoice_number),notes=body.notes??null;
 if(!Array.isArray(body.items)||body.items.length<1||body.items.length>100)throw new ApiError(422,'Invoice requires 1–100 items');
 // Requires a source-side decimal library for fractional quantity and VAT; intentionally restrict to
 // whole quantities and integer VAT percent until approved tax rounding is implemented.
 let subtotal=0,vat=0;
 const items=body.items.map(item=>{
 const qty=Number(item.quantity),rate=Number(item.vat_rate);
 if(!Number.isSafeInteger(qty)||qty<1||qty>100000||![0,15].includes(rate))throw new ApiError(422,'Unsupported quantity or VAT rate');
 const unit=amount(item.unit_price,true),line=qty*unit,inc=Math.round(line*rate/100);
 if(!Number.isSafeInteger(line)||line>1e14)throw new ApiError(422,'Amount too large');
 subtotal+=line;vat+=inc;
 return {description:memo(item.description),qty,rate,unit,line};});
 if(subtotal<=0)throw new ApiError(422,'Invoice total must be positive');
 const total=subtotal+vat;
 return tx(pool,async c=>{
 const fresh=uuid(),id=await idempotent(c,tenant,op,'create_invoice',fresh);if(id!==fresh)return {id,replayed:true};
 const customers=await execute(c,`SELECT id FROM customers WHERE id=? AND user_id=? AND is_active=1 FOR UPDATE`,[customer,tenant]);
 if(customers.length!==1)throw new ApiError(404,'Customer not found');
 const rows=await execute(c,`SELECT id,code FROM accounts WHERE user_id=? AND code IN ('1100','4000','2200') AND is_active=1 FOR UPDATE`,[tenant]);
 const map=Object.fromEntries(rows.map(r=>[r.code,r.id]));if(!map['1100']||!map['4000']||(vat>0&&!map['2200']))throw new ApiError(422,'Required chart of accounts is missing');
 await execute(c,`INSERT INTO invoices (id,user_id,customer_id,invoice_number,invoice_date,due_date,subtotal,vat_amount,total,amount_paid,status,notes) VALUES (?,?,?,?,?,?,?,?,?,'0.00','sent',?)`,[id,tenant,customer,number,invoiceDate,dueDate,asDecimal(subtotal),asDecimal(vat),asDecimal(total),notes]);
 for(const item of items)await execute(c,`INSERT INTO invoice_items (id,user_id,invoice_id,description,quantity,unit_price,vat_rate,line_total) VALUES (?,?,?,?,?,?,?,?)`,[uuid(),tenant,id,item.description,item.qty,asDecimal(item.unit),item.rate,asDecimal(item.line)]);
 const lines=[{account_id:map['1100'],debit:asDecimal(total),credit:'0'},{account_id:map['4000'],debit:'0',credit:asDecimal(subtotal)}];
 if(vat)lines.push({account_id:map['2200'],debit:'0',credit:asDecimal(vat)});
 await journal(c,tenant,{id:uuid(),date:invoiceDate,reference:number,description:`Invoice ${number}`,source:'invoice',sourceId:id,lines});
 await audit(c,tenant,'invoice.create',id);return {id,replayed:false};
 });
}
export async function receivePayment(pool,tenant,invoiceId,body,op){
 validUuid(tenant);validUuid(invoiceId);key(op);const date=dateOnly(body.payment_date);const payment=amount(body.amount);
 return tx(pool,async c=>{
 const fresh=uuid(),id=await idempotent(c,tenant,op,'receive_payment',fresh);if(id!==fresh)return {id,replayed:true};
 const invoices=await execute(c,`SELECT id,invoice_number,total,amount_paid,status FROM invoices WHERE id=? AND user_id=? FOR UPDATE`,[invoiceId,tenant]);
 if(invoices.length!==1)throw new ApiError(404,'Invoice not found');
 const inv=invoices[0],remaining=amount(inv.total,true)-amount(inv.amount_paid,true);
 if(inv.status==='cancelled'||payment>remaining||remaining===0)throw new ApiError(409,'Payment exceeds outstanding balance or invoice is closed');
 const rows=await execute(c,`SELECT id,code FROM accounts WHERE user_id=? AND code IN ('1000','1100') AND is_active=1 FOR UPDATE`,[tenant]);
 const map=Object.fromEntries(rows.map(r=>[r.code,r.id]));if(!map['1000']||!map['1100'])throw new ApiError(422,'Bank or receivable account missing');
 await journal(c,tenant,{id:uuid(),date,reference:inv.invoice_number,description:`Receipt for ${inv.invoice_number}`,source:'payment',sourceId:id,lines:[{account_id:map['1000'],debit:asDecimal(payment),credit:'0'},{account_id:map['1100'],debit:'0',credit:asDecimal(payment)}]});
 const paid=amount(inv.amount_paid,true)+payment;
 await execute(c,`UPDATE invoices SET amount_paid=?, status=?,updated_at=NOW() WHERE id=? AND user_id=?`,[asDecimal(paid),paid===amount(inv.total,true)?'paid':'partial',invoiceId,tenant]);
 await audit(c,tenant,'invoice.payment',id);return {id,replayed:false};
 });
}
