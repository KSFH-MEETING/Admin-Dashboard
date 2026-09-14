import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source = ts.transpileModule(fs.readFileSync(new URL('../lib/server/telegram.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const env = url(`
export const values={TELEGRAM_BOT_TOKEN:'token',TELEGRAM_CHAT_ID:'-1002284272771',TELEGRAM_TOPIC_ID:'1601'};
export const optionalEnv=(name)=>values[name]||'';
export const requiredEnv=(name)=>{const value=optionalEnv(name);if(!value)throw new Error('missing '+name);return value};
`);
const moduleUrl = url(source.replaceAll("'./env'", JSON.stringify(env)));
const { updateBookingMessage } = await import(moduleUrl);

const booking = (overrides = {}) => ({
  bookingId:'KSFH-1',requestId:'request-1',createdAt:'',updatedAt:'',status:'CONFIRMED',title:'Meeting',
  coordinator:'Staff',phone:'',department:'Office',room:'Room',date:'2026-09-14',startTime:'09:00',endTime:'10:00',
  attendees:1,technicalStaff:[],equipment:[],notes:'',timeZone:'Asia/Phnom_Penh',source:'web',googleEventId:'event',
  telegramMessageId:'42',telegramUserId:'',error:'',telegramChatId:'-1002284272771',telegramTopicId:'1601',
  telegramStatus:'SYNCED',telegramUpdatedAt:'',...overrides,
});

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('edits a message only when its saved chat and topic match the current destination', async () => {
  const calls = [];
  globalThis.fetch = async (request, init) => { calls.push({ request:String(request), body:JSON.parse(init.body) }); return response({ok:true,result:{message_id:42}}); };
  const result = await updateBookingMessage(booking(), 'updated');
  assert.equal(calls.length, 1);
  assert.match(calls[0].request, /editMessageText$/);
  assert.equal(result.status, 'SYNCED');
  assert.equal(result.messageId, '42');
});

test('sends a new topic message for a legacy or different destination', async () => {
  const calls = [];
  globalThis.fetch = async (request, init) => { calls.push({ request:String(request), body:JSON.parse(init.body) }); return response({ok:true,result:{message_id:99}}); };
  const result = await updateBookingMessage(booking({telegramChatId:'',telegramTopicId:'',telegramStatus:'LEGACY'}), 'updated');
  assert.equal(calls.length, 1);
  assert.match(calls[0].request, /sendMessage$/);
  assert.equal(calls[0].body.message_thread_id, 1601);
  assert.deepEqual({status:result.status,messageId:result.messageId,chatId:result.chatId,topicId:result.topicId}, {status:'NEW_MESSAGE',messageId:'99',chatId:'-1002284272771',topicId:'1601'});
});

test('falls back to a new message when Telegram refuses to edit the saved message', async () => {
  const calls = [];
  globalThis.fetch = async (request, init) => {
    calls.push({ request:String(request), body:JSON.parse(init.body) });
    return calls.length === 1 ? response({ok:false,description:"Bad Request: message can't be edited"}, 400) : response({ok:true,result:{message_id:100}});
  };
  const result = await updateBookingMessage(booking(), 'canceled');
  assert.equal(calls.length, 2);
  assert.match(calls[0].request, /editMessageText$/);
  assert.match(calls[1].request, /sendMessage$/);
  assert.equal(result.status, 'NEW_MESSAGE');
  assert.equal(result.messageId, '100');
});

test('treats an unchanged Telegram message as already synchronized', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return response({ok:false,description:'Bad Request: message is not modified'}, 400); };
  const result = await updateBookingMessage(booking(), 'updated');
  assert.equal(calls, 1);
  assert.equal(result.status, 'SYNCED');
  assert.equal(result.messageId, '42');
});
