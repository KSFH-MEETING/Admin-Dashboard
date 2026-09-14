import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source = ts.transpileModule(fs.readFileSync(new URL('../lib/server/calendar-sync.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const google = url(`
export const state={rows:[],events:[],updates:[],calendarUpdates:[]};
export async function listBookingRows(){return state.rows}
export async function listCalendarEventsForMonth(){return state.events}
export async function getCalendarEvent(id){return state.events.find(event=>event.id===id)||null}
export async function updateCalendarEvent(booking){state.calendarUpdates.push(booking.bookingId)}
export async function deterministicEventId(id){return 'new-'+id}
export async function ensureCalendarEvent(booking){return booking.googleEventId}
export async function updateBooking(rowNumber,booking){state.updates.push({rowNumber,booking})}
`);
const moduleUrl = url(source.replaceAll("'./google'", JSON.stringify(google)));
const { checkCalendarMonth, eventMatchesBooking, parseCalendarMonth, syncCalendarMonth } = await import(moduleUrl);
const { state } = await import(google);

const booking = (id, eventId='', status='CONFIRMED') => ({
  bookingId:id,requestId:'request-'+id,createdAt:'',updatedAt:'',status,title:'Meeting '+id,
  coordinator:'Staff',phone:'',department:'Office',room:'Room',date:'2026-01-12',
  startTime:'09:00',endTime:'10:00',attendees:1,technicalStaff:[],equipment:[],notes:'',
  timeZone:'Asia/Phnom_Penh',source:'legacy-form-ksfh',googleEventId:eventId,
  telegramMessageId:'',telegramUserId:'',error:'',
  telegramChatId:'',telegramTopicId:'',telegramStatus:'',telegramUpdatedAt:'',
});
const event = (id, start='2026-01-12T09:00', requestId='') => ({
  id,status:'confirmed',summary:'📅 Meeting '+id.replace('e','b'),location:'Room',
  start:{dateTime:start+':00+07:00'},end:{dateTime:'2026-01-12T10:00:00+07:00'},
  extendedProperties:{private:requestId?{requestId}:{}},
});

test('month validation and event time matching are strict', () => {
  assert.equal(parseCalendarMonth('2026-01'),'2026-01');
  assert.throws(()=>parseCalendarMonth('01/2026'));
  assert.equal(eventMatchesBooking(event('e1'),booking('b1','e1')),true);
  assert.equal(eventMatchesBooking(event('e1','2026-01-13T09:00'),booking('b1','e1')),false);
});

test('check summarizes linked, missing and mismatched bookings', async () => {
  state.rows=[
    {rowNumber:2,booking:booking('b1','e1')},
    {rowNumber:3,booking:booking('b2')},
    {rowNumber:4,booking:booking('b3','gone')},
    {rowNumber:5,booking:booking('b4','e4')},
    {rowNumber:6,booking:booking('b5','', 'CANCELED')},
  ];
  state.events=[event('e1'),event('e4','2026-01-13T09:00')];
  assert.deepEqual(await checkCalendarMonth('2026-01'),{
    month:'2026-01',total:4,linked:1,needsSync:3,missingLink:1,missingEvent:1,dateMismatches:1,
  });
});

test('sync repairs only pending rows and reports progress', async () => {
  state.updates=[];state.calendarUpdates=[];
  state.events=[event('e1'),event('e2','2026-01-12T09:00','request-b2'),event('e4','2026-01-13T09:00','request-b4')];
  const result=await syncCalendarMonth('2026-01');
  assert.equal(result.processed,3);
  assert.equal(result.failed,0);
  assert.equal(result.needsSync,0);
  assert.equal(state.updates.length,3);
  assert.deepEqual(state.calendarUpdates,['b2','b4']);
  assert.equal(state.updates.find(item=>item.booking.bookingId==='b3').booking.googleEventId,'new-request-b3');
});
