import XCTest
final class ProbeTests:XCTestCase {
 func tap(_ app:XCUIApplication,_ name:String){let q=app.buttons.matching(identifier:name);XCTAssertTrue(q.firstMatch.waitForExistence(timeout:10),app.debugDescription);if q.count==1{q.firstMatch.tap();return};guard let b=q.allElementsBoundByIndex.first(where:{$0.isHittable})else{XCTFail("No hittable button "+name);return};b.tap()}
 func testAIColdStartOffersExplicitContinueForLiveSession() throws {
 continueAfterFailure=false
 let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();tap(app,"Ask Fancy");XCTAssertTrue(app.staticTexts["A little help finding your table."].waitForExistence(timeout:10),app.debugDescription);print("QA_NATIVE69_COLD_AI_HOME\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native69-ai-cold-home";a.lifetime = .keepAlways;add(a);XCTAssertTrue(app.buttons["Continue conversation"].waitForExistence(timeout:8),"Accepted design requires explicit Continue for still-valid same-install session; actual UI:\n"+app.debugDescription)
 }
}
