import type { Pool } from 'pg';
import { ADMIN_DEFINITION_VERSION } from '@fancy/contracts';
import { projectLifecycle, type MealRow } from '../meals/lifecycle.ts';

/** Source filter options: the first segment of each stored sign-up source (utm source, ios_app, meal_link). */
export function signupSourceDimensions(values:Array<string|null>){
  return [...new Set(values.filter((v):v is string=>!!v).map(v=>v.split(':')[0]!))].sort().map(code=>({code,label:code}));
}

/**
 * Internal worker boundary. Captures one repeatable-read database view at server now.
 * Historical arbitrary asOf is intentionally unsupported: mutable source tables cannot
 * reconstruct earlier row values without versioned facts. No client can create snapshots.
 */
export async function sealSourceSnapshot(pool: Pool, historyCoverageStart: Date,readiness:{verifiedDiscovery?:boolean;clientTelemetry?:boolean}={}): Promise<string> {
  if (!Number.isFinite(historyCoverageStart.getTime())) throw new Error('INVALID_HISTORY_COVERAGE');
  const db = await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    // node-postgres maps timestamptz to millisecond Date. Keep SQL's exact boundary as text
    // so facts committed in the same millisecond are neither omitted nor misclassified.
    const { rows: clock } = await db.query<{ as_of: string }>('SELECT transaction_timestamp()::text AS as_of');
    const asOf = clock[0]!.as_of;
    const lifecycleNow = new Date(asOf);
    if (historyCoverageStart > lifecycleNow) throw new Error('INVALID_HISTORY_COVERAGE');
    // Serializes publication with the account-deletion privacy barrier. The deletion
    // worker can revoke/purge via analytics_snapshot_subjects before making data available.
    const { rows: privacy } = await db.query<{ epoch: string }>('SELECT epoch::text FROM privacy_control WHERE id=1 FOR SHARE');
    const { rows: classifications } = await db.query(`SELECT DISTINCT ON(user_id) user_id,classification,revision::text FROM account_classifications WHERE created_at<=$1 ORDER BY user_id,revision DESC`, [asOf]);
    const excluded = classifications.filter(c => c.classification !== 'regular').map(c => c.user_id);
    // v5: sign-up platform is the member's earliest WEB/IOS session family (no new tracking); it is
    // lost when an account deletion purges session families. completed_at is the first profile completion.
    const { rows: users } = await db.query(`SELECT u.id,u.created_at,u.signup_source,p.completed_at,
        (SELECT sf.kind FROM session_families sf WHERE sf.user_id=u.id AND sf.kind IN('WEB','IOS') AND sf.created_at<=$1 ORDER BY sf.created_at,sf.id LIMIT 1) AS signup_platform
      FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.status='ACTIVE' AND u.created_at<=$1 AND NOT(u.id=ANY($2::uuid[]))`, [asOf,excluded]);
    const ids = users.map(u => u.id);
    // Consent coverage: member login families and whether each one currently holds an analytics grant.
    const { rows: families } = await db.query(`SELECT sf.user_id,sf.kind,sf.created_at,(c.granted_at IS NOT NULL AND c.granted_at<=$1) AS consented
      FROM session_families sf LEFT JOIN analytics_consents c ON c.scope_key='family:'||sf.id::text
      WHERE sf.created_at<=$1 AND sf.kind IN('WEB','IOS') AND sf.user_id=ANY($2::uuid[])`, [asOf,ids]);
    // A deleted regular host does not erase the shared meal or surviving guests' history.
    // Classification exclusion remains meal-wide; active-account scope below is user-specific.
    const { rows: meals } = await db.query(`SELECT id,host_id,starts_at,closes_at,scheduled_end_at,minimum,capacity,budget_max_pence,languages,area_code,status,cancel_reason,created_at,attempt_id FROM meals WHERE created_at<=$1 AND NOT(host_id=ANY($2::uuid[]))`, [asOf,excluded]);
    const mealIds = meals.map(m => m.id);
    const { rows: applications } = await db.query(`SELECT id,meal_id,user_id,round,state,created_at,decided_at FROM applications WHERE created_at<=$1 AND meal_id=ANY($2::uuid[]) AND user_id=ANY($3::uuid[])`, [asOf,mealIds,ids]);
    const { rows: allSeats } = await db.query(`SELECT meal_id,seq::text,user_id,application_id,type,effective_at,recorded_at FROM seat_events WHERE effective_at<=$1 AND recorded_at<=$1 AND meal_id=ANY($2::uuid[]) ORDER BY meal_id,seq`, [asOf,mealIds]);
    // Projection consumes all authoritative business seats, while statistical membership and
    // formation below exclude classified accounts. Analysis never re-executes cancellation.
    for(const meal of meals){const projected=projectLifecycle(meal as Pick<MealRow,'status'|'cancel_reason'|'closes_at'|'scheduled_end_at'|'minimum'>,allSeats.filter(s=>s.meal_id===meal.id).map(s=>({userId:s.user_id,type:s.type,effectiveAt:s.effective_at,seq:BigInt(s.seq)})),lifecycleNow);meal.status=projected.status;meal.cancel_reason=projected.cancelReason;}
    const validIds=new Set(ids);const seats=allSeats.filter(s=>validIds.has(s.user_id));
    const { rows: surveys } = await db.query(`SELECT DISTINCT ON(user_id) user_id,version::text,again,reasons,submitted_at FROM product_surveys WHERE submitted_at<=$1 AND user_id=ANY($2::uuid[]) ORDER BY user_id,version DESC`, [asOf,ids]);
    // Rebuild authenticated history using this snapshot's classification revision. Anonymous
    // events retain their trusted ingress class and are never linked retrospectively.
    const { rows: events } = await db.query(`SELECT event_id,anonymous_id,user_id,session_id,type,occurred_at,received_at,properties FROM analytics_events WHERE occurred_at<=$1 AND received_at<=$1 AND environment='production' AND ((user_id IS NULL AND classification='regular') OR user_id=ANY($2::uuid[])) AND (properties->>'mealId' IS NULL OR properties->>'mealId'=ANY($3::text[]))`, [asOf,ids,mealIds]);
    const {rows:attendance}=await db.query(`SELECT meal_id,subject_id,source,value,version::text,actor_id,created_at FROM attendance_revisions WHERE created_at<=$1 AND meal_id=ANY($2::uuid[]) AND subject_id=ANY($3::uuid[])`,[asOf,mealIds,ids]);
    const {rows:experiences}=await db.query(`SELECT meal_id,user_id,score,revision::text,created_at FROM experience_revisions WHERE created_at<=$1 AND meal_id=ANY($2::uuid[]) AND user_id=ANY($3::uuid[])`,[asOf,mealIds,ids]);
    const {rows:rosters}=await db.query(`SELECT meal_id,user_id,starts_at FROM start_roster WHERE created_at<=$1 AND meal_id=ANY($2::uuid[]) AND user_id=ANY($3::uuid[])`,[asOf,mealIds,ids]);
    const {rows:excludedEvents}=await db.query(`SELECT event_id,type,occurred_at,CASE WHEN environment<>'production' THEN 'environment' ELSE 'account_classification' END AS reason FROM analytics_events WHERE occurred_at<=$1 AND received_at<=$1 AND (environment<>'production' OR (user_id IS NULL AND classification<>'regular') OR (user_id IS NOT NULL AND NOT(user_id=ANY($2::uuid[]))))`,[asOf,ids]);
    const{rows:deliveryRows}=await db.query(`SELECT id,event_id,outcome,reason,received_at FROM analytics_deliveries WHERE received_at<=$1 AND environment='production' AND ((user_id IS NULL AND classification NOT IN('test','staff')) OR user_id=ANY($2::uuid[]))`,[asOf,ids]);
    const{rows:coverage}=await db.query<{started_at:Date}>(`SELECT started_at FROM analytics_delivery_coverage WHERE id=1`);
    const deliveryComplete=!!coverage[0]&&coverage[0].started_at<=historyCoverageStart;
    const quality={excludedEvents:excludedEvents.length,deliveryComplete,deliveryCoverageStart:coverage[0]?.started_at.toISOString()??null,incompleteSources:[...(!readiness.verifiedDiscovery?['verifiedDiscovery']:[]),...(!readiness.clientTelemetry?['clientTelemetry']:[]),...(!deliveryComplete?['deliveryHistory']:[])],telemetryIdentityMapping:'no_historical_linking'};
    const revision = classifications.reduce((max: bigint, c) => BigInt(c.revision) > max ? BigInt(c.revision) : max, 0n).toString();
    const sourceStatus = { accounts: 'ready', families: 'ready', classifications: 'ready', meals: 'ready', applications: 'ready', seats: 'ready', productSurvey: 'ready', analytics: readiness.verifiedDiscovery&&readiness.clientTelemetry?'ready':'partial', attendance: 'ready', experience: 'ready',deliveries:deliveryComplete?'ready':'partial' };
    const { rows: snapshots } = await db.query<{ id: string }>(`INSERT INTO analytics_snapshots(as_of,definition_version,history_coverage_start,privacy_epoch,classification_revision,source_status,quality,dimensions) VALUES($1,$8,$2,$3,$4,$5,$6,$7) RETURNING id`, [asOf,historyCoverageStart,privacy[0]!.epoch,revision,sourceStatus,quality,{ areas: [...new Set(meals.map(m => m.area_code as string))].sort().map(code => ({ code,label: code })), sources: signupSourceDimensions(users.map(u => u.signup_source as string|null)) },ADMIN_DEFINITION_VERSION]);
    const id = snapshots[0]!.id;
    for (const [kind,facts] of Object.entries({ users,families,meals,applications,seats,surveys,events,attendance,experiences,rosters,quality,excludedEvents,deliveries:deliveryRows,discoveryReady:!!readiness.verifiedDiscovery,telemetryReady:!!readiness.clientTelemetry })) await db.query(`INSERT INTO analytics_snapshot_facts(snapshot_id,kind,facts) VALUES($1,$2,$3)`, [id,kind,JSON.stringify(facts)]);
    for (const user of users) await db.query(`INSERT INTO analytics_snapshot_subjects(snapshot_id,user_id) VALUES($1,$2)`, [id,user.id]);
    await db.query('COMMIT');
    return id;
  } catch (e) { await db.query('ROLLBACK'); throw e; }
  finally { db.release(); }
}
