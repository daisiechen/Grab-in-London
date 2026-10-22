import XCTest
final class ProbeTests:XCTestCase {
 func tap(_ app:XCUIApplication,_ name:String){let q=app.buttons.matching(identifier:name);XCTAssertTrue(q.firstMatch.waitForExistence(timeout:10),app.debugDescription);if q.count==1{q.firstMatch.tap();return};guard let b=q.allElementsBoundByIndex.first(where:{$0.isHittable})else{XCTFail("No hittable button "+name);return};b.tap()}
 func testAIStartNormalGuestSessionBeforeColdLaunch() throws {
 continueAfterFailure=false
 let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();tap(app,"Ask Fancy");tap(app,"Start conversation");XCTAssertTrue(app.textViews["Ask Fancy a question"].waitForExistence(timeout:15),app.debugDescription);print("QA_NATIVE68_AI_GUEST_READY\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native68-ai-ready";a.lifetime = .keepAlways;add(a)
 }
}
