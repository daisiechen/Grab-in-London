import {ReadAcknowledger} from './read-ack.ts';
import {deferred} from '../../test/deferred.ts';
describe('rendered message acknowledgements',()=>{
 it('never acknowledges fetch alone or hidden messages, and advances monotonically through rendered/scanned progress',async()=>{
  const sent:string[]=[];const ack=new ReadAcknowledger(async seq=>{sent.push(seq);});ack.scannedThrough('15','12');await ack.presented(['12']);expect(sent).toEqual([]);
  ack.setActive(true);await ack.presented(['10']);expect(sent).toEqual(['10']);await ack.presented(['12']);expect(sent).toEqual(['10','15']);await ack.presented(['11','12']);expect(sent).toEqual(['10','15']);
 });
 it('ignores a late success after leaving and does not automatically retry a failure',async()=>{
  const held=deferred<void>();let calls=0;const ack=new ReadAcknowledger(async()=>{calls++;return held.promise;});ack.setActive(true);const request=ack.presented(['4']);ack.setActive(false);held.resolve();await request;expect(ack.through).toBe('0');
  const failed=new ReadAcknowledger(async()=>{calls++;throw Error('offline');});failed.setActive(true);await failed.presented(['5']);await failed.presented(['5']);expect(calls).toBe(2);
 });
});
