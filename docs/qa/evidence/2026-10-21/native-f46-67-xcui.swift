import XCTest
final class ProbeTests:XCTestCase {
 func tap(_ app:XCUIApplication,_ name:String){let q=app.buttons.matching(identifier:name);XCTAssertTrue(q.firstMatch.waitForExistence(timeout:10),app.debugDescription);if q.count==1{q.firstMatch.tap();return};guard let b=q.allElementsBoundByIndex.first(where:{$0.isHittable})else{XCTFail("No hittable button "+name);return};b.tap()}
 func testF44ColdLaunchRemainsGuestAfterLocalSignOut() throws {
 continueAfterFailure=false
 let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();tap(app,"Profile, tab, 5 of 5");XCTAssertTrue(app.buttons["Sign in or create an account"].waitForExistence(timeout:12),app.debugDescription);XCTAssertFalse(app.buttons["Settings"].exists);print("QA_NATIVE67_COLD_GUEST\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native67-cold-guest";a.lifetime = .keepAlways;add(a)
 }
}
