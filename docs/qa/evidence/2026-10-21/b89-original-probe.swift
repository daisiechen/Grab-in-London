import XCTest
final class ProbeTests:XCTestCase {
 func testGuestReceiptEntry() {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev")
  app.launch()
  let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:8){decline.tap()}
  let profile=app.buttons["Profile, tab, 5 of 5"]
  XCTAssertTrue(profile.waitForExistence(timeout:20));profile.tap()
  XCTAssertTrue(app.staticTexts["Your profile"].firstMatch.waitForExistence(timeout:15))
  XCTAssertTrue(app.buttons["Sign in or create an account"].exists)
  let a=XCTAttachment(screenshot:app.screenshot());a.name="PUBLIC-original-guest-profile";a.lifetime = .keepAlways;add(a)
  print("QA_GUEST_PROFILE_SETTINGS=\(app.buttons["Settings"].exists) RECEIPT_ENTRY=\(app.buttons["Check deletion status"].exists)")
  XCTAssertTrue(app.buttons["Check deletion status"].exists,"Original signed-out profile has no normal receipt status entry")
 }
}
