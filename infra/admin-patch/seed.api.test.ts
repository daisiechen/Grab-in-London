import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {createHarness,type Harness} from '../../apps/api/src/test/harness.ts';
import {sealSourceSnapshot} from '../../apps/api/src/admin/snapshots.ts';
import {loadAdminSnapshot} from '../../apps/api/src/admin/pages.ts';
import {seedAdminScenario,ADMIN_SCENARIO,ADMIN_TARGET} from './seed.ts';
let h:Harness;beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
it('creates real SQL source facts with hand-counted self-first attendance and enough rows for paging',async()=>{
 expect(await seedAdminScenario(h.db.pool)).toEqual(ADMIN_SCENARIO);
 const snapshotId=await sealSourceSnapshot(h.db.pool,new Date('2026-07-01'));
 const {calculated}=await loadAdminSnapshot(h.db.pool,{snapshotId,from:'2026-10-01',to:'2026-10-23'});
 expect(calculated.metrics.coverage).toEqual({numerator:64,denominator:80});
 expect(calculated.rows.attendance).toHaveLength(80);
 expect(calculated.rows.attendance!.filter(r=>r.attributes.attendanceStatus==='present')).toHaveLength(48);
 expect(calculated.rows.attendance!.filter(r=>r.attributes.attendanceStatus==='absent')).toHaveLength(16);
 expect(calculated.rows.attendance!.filter(r=>r.attributes.attendanceStatus==='unknown')).toHaveLength(16);
 expect(calculated.rows.attendance!.filter(r=>r.attributes.userId===ADMIN_TARGET).every(r=>r.attributes.source==='SELF'&&r.inNumerator)).toBe(true);
 await expect(seedAdminScenario(h.db.pool)).rejects.toThrow('ADMIN_SEED_REQUIRES_EMPTY_MEALS');
 expect((await h.db.pool.query(`SELECT count(*)::int n FROM meals`)).rows[0].n).toBe(16);
});
