import XCTest
final class ProbeTests: XCTestCase {
 func type(_ field:XCUIElement,_ value:String){field.tap();for c in value{field.typeText(String(c));Thread.sleep(forTimeInterval:0.15)}}
 func capture(_ app:XCUIApplication,_ name:String){let attachment=XCTAttachment(screenshot:app.screenshot());attachment.name=name;attachment.lifetime = .keepAlways;add(attachment);print("QA_UI_TREE_"+name+"\n"+app.debugDescription)}
 func testAuthenticationIntoSetup() throws {
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch()
  let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:15){decline.tap()}
  let profile=app.buttons["Profile, tab, 5 of 5"];XCTAssertTrue(profile.waitForExistence(timeout:10),app.debugDescription);profile.tap()
  let signin=app.buttons["Sign in or create an account"];XCTAssertTrue(signin.waitForExistence(timeout:10),app.debugDescription);signin.tap()
  let email=app.buttons["Continue with email"];XCTAssertTrue(email.waitForExistence(timeout:10),app.debugDescription);email.tap()
  let field=app.textFields["Email address"];XCTAssertTrue(field.waitForExistence(timeout:10),app.debugDescription)
  type(field,"bad-address");app.buttons["Send code"].tap();XCTAssertTrue(app.staticTexts["Enter a valid email address."].waitForExistence(timeout:5),app.debugDescription)
  field.tap();field.typeText(String(repeating:XCUIKeyboardKey.delete.rawValue,count:11));type(field,"qa-native-r1@example.invalid");app.buttons["Send code"].tap()
  let code=app.textFields["6-digit code"];XCTAssertTrue(code.waitForExistence(timeout:15),app.debugDescription);type(code,"111111");app.buttons["Verify & continue"].tap()
  XCTAssertTrue(app.staticTexts["That code doesn’t match. Check the six digits and try again."].waitForExistence(timeout:10),app.debugDescription)
  code.tap();code.typeText(String(repeating:XCUIKeyboardKey.delete.rawValue,count:6));type(code,"000000");app.buttons["Verify & continue"].tap()
  XCTAssertTrue(app.staticTexts["A face. A little story. You."].waitForExistence(timeout:15),app.debugDescription);capture(app,"new-account-profile-setup")
 }
}
