import {test} from 'node:test';
import assert from 'node:assert/strict';
import {amount,asDecimal,dateOnly,key,tx,postManualJournal,createInvoice,receivePayment} from '../domain.mjs';
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const account='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const basic={entry_date:'2026-10-11',description:'Opening journal',lines:[{account_id:account,debit:'20.00',credit:'0'},{account_id:account,debit:'0',credit:'20.00'}]};
function fake(handler=()=>[]){const log=[];const c={beginTransaction:async()=>log.push('begin'),commit:async()=>log.push('commit'),rollback:async()=>log.push('rollback'),release:()=>log.push('release'),execute:async(s,p)=>{log.push([s,p]);return [handler(s,p)]}};return {pool:{getConnection:async()=>c},log};}
test('decimal string precision and input rejection',()=>{assert.equal(amount('0.01'),1);assert.equal(amount('10.00'),1000);assert.equal(asDecimal(1001),'10.01');for(const x of ['1.001','1e3','-1','NaN','0.00',' 1.00'])assert.throws(()=>amount(x));});
test('invalid date and idempotency keys rejected',()=>{assert.throws(()=>dateOnly('2026-02-30'));assert.throws(()=>key('short'));});
test('commit on success, release connection',async()=>{const {pool,log}=fake();await tx(pool,async()=>42);assert.deepEqual(log,['begin','commit','release']);});
test('rollback on error, release connection',async()=>{const {pool,log}=fake();await assert.rejects(()=>tx(pool,async()=>{throw Error('failure')}));assert.deepEqual(log,['begin','rollback','release']);});
test('unbalanced manual journal cannot write any SQL',async()=>{let fresh;const {pool,log}=fake((sql,p)=>{if(sql.startsWith('INSERT IGNORE'))fresh=p[3];return sql.startsWith('SELECT operation_type')?[{entity_id:fresh,operation_type:'manual_journal'}]:[]});await assert.rejects(()=>postManualJournal(pool,id,{...basic,lines:[{account_id:account,debit:'20',credit:'0'},{account_id:account,debit:'0',credit:'19'}]},'operation-123456'),/balanced/);assert(log.includes('rollback'));assert(!log.includes('commit'));});
test('missing account rolls back',async()=>{let fresh;const {pool,log}=fake((sql,p)=>{if(sql.startsWith('INSERT IGNORE'))fresh=p[3];return sql.startsWith('SELECT operation_type')?[{entity_id:fresh,operation_type:'manual_journal'}]:[]});await assert.rejects(()=>postManualJournal(pool,id,basic,'operation-123456'),/Account missing/);assert(log.includes('rollback'));assert(!log.includes('commit'));});
test('invoice rejects unsupported fractional quantity before starting transaction',async()=>{const {pool,log}=fake();await assert.rejects(()=>createInvoice(pool,id,{customer_id:id,invoice_number:'INV-X',invoice_date:'2026-10-11',due_date:'2026-10-12',items:[{description:'Service',quantity:1.25,unit_price:'10.00',vat_rate:15}]},'operation-123456'),/Unsupported/);assert.equal(log.length,0);});
test('payment amount rejects invalid negative amounts before SQL',async()=>{const {pool,log}=fake();await assert.rejects(()=>receivePayment(pool,id,id,{payment_date:'2026-10-11',amount:'-10.00'},'operation-123456'));assert.equal(log.length,0);});
test('successful manual journal posts header, two lines and audit atomically',async()=>{
 let fresh;
 const {pool,log}=fake((sql,p)=>{
  if(sql.startsWith('INSERT IGNORE'))fresh=p[3];
  if(sql.startsWith('SELECT operation_type'))return [{operation_type:'manual_journal',entity_id:fresh}];
  if(sql.startsWith('SELECT id FROM accounts'))return [{id:account}];
  return [];
 });
 const result=await postManualJournal(pool,id,basic,'operation-123456');
 assert.equal(result.replayed,false);assert(log.includes('commit'));assert.equal(log.filter(x=>Array.isArray(x)&&x[0].startsWith('INSERT INTO journal_lines')).length,2);
 assert.equal(log.filter(x=>Array.isArray(x)&&x[0].startsWith('INSERT INTO audit_events')).length,1);
});
test('replayed journal key returns existing result without new journal lines',async()=>{
 const prior='cccccccc-cccc-4ccc-cccc-cccccccccccc';
 const {pool,log}=fake((sql)=>sql.startsWith('SELECT operation_type')?[{operation_type:'manual_journal',entity_id:prior}]:[]);
 const result=await postManualJournal(pool,id,basic,'operation-123456');
 assert.deepEqual(result,{id:prior,replayed:true});
 assert.equal(log.filter(x=>Array.isArray(x)&&x[0].startsWith('INSERT INTO journal_lines')).length,0);
});
