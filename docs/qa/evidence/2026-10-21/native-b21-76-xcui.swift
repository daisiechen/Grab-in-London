import XCTest
final class ProbeTests:XCTestCase {
 func tap(_ app:XCUIApplication,_ name:String){let q=app.buttons.matching(identifier:name);XCTAssertTrue(q.firstMatch.waitForExistence(timeout:12),app.debugDescription);if q.count==1{q.firstMatch.tap();return};guard let b=q.allElementsBoundByIndex.first(where:{$0.isHittable})else{XCTFail("No hittable button "+name);return};b.tap()}
 func testFormalF45ColdExplicitContinueSameSessionWithoutPersistedText() throws {
 continueAfterFailure=false
 let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();tap(app,"Profile, tab, 5 of 5");XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout:12),app.debugDescription);tap(app,"Ask Fancy");let c=app.buttons["Continue conversation"];XCTAssertTrue(c.waitForExistence(timeout:12),app.debugDescription);XCTAssertFalse(app.staticTexts["QACOLD75"].exists);let home=XCTAttachment(screenshot:app.screenshot());home.name="native76-f45-cold-explicit-continue";home.lifetime = .keepAlways;add(home);c.tap();let q=app.textViews["Ask Fancy a question"];XCTAssertTrue(q.waitForExistence(timeout:15),app.debugDescription);XCTAssertEqual(q.value as? String,"");XCTAssertFalse(app.staticTexts["This conversation expired. Your unsent text is kept."].exists);print("QA_NATIVE76_F45_COLD_CONTINUE_EMPTY_LOCAL_TEXT\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native76-f45-continued-no-local-text";a.lifetime = .keepAlways;add(a)
 }
}
