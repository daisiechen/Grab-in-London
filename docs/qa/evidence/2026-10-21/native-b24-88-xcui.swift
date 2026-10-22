import XCTest
final class ProbeTests:XCTestCase {
 func tap(_ app:XCUIApplication,_ name:String){let q=app.buttons.matching(identifier:name);XCTAssertTrue(q.firstMatch.waitForExistence(timeout:12),app.debugDescription);if q.count==1{q.firstMatch.tap();return};guard let b=q.allElementsBoundByIndex.first(where:{$0.isHittable})else{XCTFail("No hittable button "+name);return};b.tap()}
 func type(_ field:XCUIElement,_ value:String){field.tap();for c in value{field.typeText(String(c));Thread.sleep(forTimeInterval:0.15)}}
 func testProxyNormalLoginExistingProfile() throws {
 continueAfterFailure=false
 let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:2){decline.tap()};tap(app,"Profile, tab, 5 of 5");tap(app,"Sign in or create an account");tap(app,"Continue with email");let email=app.textFields["Email address"];XCTAssertTrue(email.waitForExistence(timeout:10));type(email,"qa-f48-native80@example.invalid");XCTAssertEqual(email.value as? String,"qa-f48-native80@example.invalid");tap(app,"Send code");let code=app.textFields["6-digit code"];XCTAssertTrue(code.waitForExistence(timeout:12),app.debugDescription);type(code,"000000");tap(app,"Verify & continue");XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout:12),app.debugDescription);print("QA_NATIVE88_PROXY_LOGIN_COMPLETE_PROFILE\n"+app.debugDescription)
 }
}
