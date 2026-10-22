import XCTest
final class ProbeTests:XCTestCase {
 func tap(_ app:XCUIApplication,_ name:String){let q=app.buttons.matching(identifier:name);XCTAssertTrue(q.firstMatch.waitForExistence(timeout:12),app.debugDescription);if q.count==1{q.firstMatch.tap();return};guard let b=q.allElementsBoundByIndex.first(where:{$0.isHittable})else{XCTFail("No hittable button "+name);return};b.tap()}
 func testFormalF45NormalStartPersistsOnlyCredentialMetadata() throws {
 continueAfterFailure=false
 let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();tap(app,"Profile, tab, 5 of 5");XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout:12),app.debugDescription);tap(app,"Ask Fancy");tap(app,"Start conversation");let q=app.textViews["Ask Fancy a question"];XCTAssertTrue(q.waitForExistence(timeout:15),app.debugDescription);q.tap();for c in "QACOLD75"{q.typeText(String(c));Thread.sleep(forTimeInterval:0.15)};XCTAssertEqual(q.value as? String,"QACOLD75");let ready=XCTNSPredicateExpectation(predicate:NSPredicate(format:"enabled == true"),object:app.buttons["Ask"]);XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:12),.completed,app.debugDescription);print("QA_NATIVE75_F45_NORMAL_START_UNSENT\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native75-f45-normal-start-unsent";a.lifetime = .keepAlways;add(a);tap(app,"Close")
 }
}
