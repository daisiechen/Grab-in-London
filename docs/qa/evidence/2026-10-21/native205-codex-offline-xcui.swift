import XCTest
final class ProbeTests:XCTestCase {
func testNativeJ008Offline205(){
continueAfterFailure=false
let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch()
let profile=app.buttons["Profile, tab, 5 of 5"]
XCTAssertTrue(profile.waitForExistence(timeout:12),app.debugDescription);profile.tap()
XCTAssertTrue(app.staticTexts["QA Final Host"].firstMatch.waitForExistence(timeout:12),app.debugDescription)
let inbox=app.buttons["Inbox, tab, 4 of 5"]
XCTAssertTrue(inbox.waitForExistence(timeout:8),app.debugDescription);inbox.tap()
let loaded=app.otherElements.matching(NSPredicate(format:"label BEGINSWITH %@","Chats · ")).firstMatch
XCTAssertTrue(loaded.waitForExistence(timeout:12),app.debugDescription)
XCTAssertFalse(app.buttons["Retry loading inbox"].exists,app.debugDescription)
let a=XCTAttachment(screenshot:app.screenshot());a.name="codex-j008-normal-h-inbox-before-offline";a.lifetime = .keepAlways;add(a)
let docs=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0]
let run=docs.appendingPathComponent("j008-offline205")
try! FileManager.default.createDirectory(at:run,withIntermediateDirectories:false,attributes:[.posixPermissions:0o700])
try! Data("loaded-H-inbox".utf8).write(to:run.appendingPathComponent("ready"),options:.atomic)
print("QA_CODEX_J008_READY_BARRIER\n"+run.path)
let signal=run.appendingPathComponent("armed")
let armed=NSPredicate { _,_ in FileManager.default.fileExists(atPath:signal.path) }
XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:armed,object:nil)],timeout:45),.completed,"No reviewed ARM signal; no pull performed")
XCTAssertEqual(try! String(contentsOf:signal,encoding:.utf8),"ONE_INBOX_OFFLINE_ARMED_205")
let list=app.otherElements["inbox"].scrollViews.firstMatch
XCTAssertTrue(list.exists,app.debugDescription)
list.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.20)).press(forDuration:0.1,thenDragTo:list.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.90)))
let retry=app.buttons["Retry loading inbox"]
XCTAssertTrue(retry.waitForExistence(timeout:8),app.debugDescription)
let failed=XCTAttachment(screenshot:app.screenshot());failed.name="codex-j008-offline-visible-error";failed.lifetime = .keepAlways;add(failed)
print("QA_CODEX_J008_OFFLINE_ERROR_OBSERVED")
XCTAssertTrue(retry.isHittable,app.debugDescription);retry.tap()
let cleared=NSPredicate { _,_ in !retry.exists }
XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:cleared,object:nil)],timeout:8),.completed,app.debugDescription)
XCTAssertTrue(loaded.exists,app.debugDescription)
let recovered=XCTAttachment(screenshot:app.screenshot());recovered.name="codex-j008-explicit-retry-recovered";recovered.lifetime = .keepAlways;add(recovered)
print("QA_CODEX_J008_EXPLICIT_RETRY_RECOVERED\n"+app.debugDescription)
}
}
