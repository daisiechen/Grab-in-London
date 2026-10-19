import {test} from "node:test";
import assert from "node:assert/strict";
import {reportAttendance, attendanceResult, saveExperience, type MealContext} from "../src/postMeal.ts";
const meal: MealContext = {id:"one",ended:true,cancelled:false,hostId:"host",participantIds:["host","u"]};
const now = "2026-10-18T20:00:00Z";
test("attendance permissions, ended eligibility, self and host sources remain separate", () => {
  assert.throws(() => reportAttendance([], {...meal,ended:false}, "u","u","present",now));
  assert.throws(() => reportAttendance([], {...meal,cancelled:true}, "u","u","present",now));
  assert.throws(() => reportAttendance([], meal, "host","outsider","present",now));
  assert.throws(() => reportAttendance([], meal, "outsider","u","present",now));
  const self = reportAttendance([], meal, "u","u","present",now);
  const both = reportAttendance(self,meal,"host","u","absent",now);
  assert.equal(attendanceResult(both,"one","u"),"conflict");
  assert.equal(self[0].source,"self");
  assert.equal(both[1].source,"host");
  assert.equal(attendanceResult(both,"another","u"),"unknown");
});
test("experience needs actual reported attendance, valid score and explicit intent; reasons optional and deduplicated", () => {
  assert.throws(() => saveExperience([],[],meal,"u",4,true,[],now));
  const reports=reportAttendance([],meal,"u","u","present",now);
  assert.throws(() => saveExperience([],reports,meal,"u",6,true,[],now));
  const first=saveExperience([],reports,meal,"u",2,false,["cost","cost"],now);
  assert.deepEqual(first[0].reasons,["cost"]);
  const updated=saveExperience(first,reports,meal,"u",4,true,[],now);
  assert.equal(updated.length,1);
  assert.equal(updated[0].score,4);
  const conflict=reportAttendance(reports,meal,"host","u","absent",now);
  assert.throws(() => saveExperience([],conflict,meal,"u",4,true,[],now));
});
