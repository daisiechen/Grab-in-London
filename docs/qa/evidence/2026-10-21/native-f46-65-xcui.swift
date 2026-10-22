import XCTest
final class ProbeTests:XCTestCase {
 func tap(_ app:XCUIApplication,_ name:String){let q=app.buttons.matching(identifier:name);XCTAssertTrue(q.firstMatch.waitForExistence(timeout:10),app.debugDescription);guard let b=q.allElementsBoundByIndex.first(where:{$0.isHittable})else{XCTFail("No hittable button "+name);return};b.tap()}
 func testF44NormalSignOutBeforeChangingTestBackend() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:3){decline.tap()};tap(app,"Profile, tab, 5 of 5");tap(app,"Settings");tap(app,"Sign out");XCTAssertTrue(app.buttons["Stay signed in"].waitForExistence(timeout:5));tap(app,"Sign out");let closed=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:app.buttons["Stay signed in"]);XCTAssertEqual(XCTWaiter.wait(for:[closed],timeout:12),.completed,app.debugDescription);tap(app,"Profile, tab, 5 of 5");XCTAssertTrue(app.buttons["Sign in or create an account"].waitForExistence(timeout:10),app.debugDescription);print("QA_NATIVE_F44_SIGNED_OUT\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-f44-normal-signed-out";a.lifetime = .keepAlways;add(a)
 }
}
