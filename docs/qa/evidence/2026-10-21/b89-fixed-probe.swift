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
  let entry=app.buttons["Check deletion status"]
  XCTAssertTrue(entry.exists,"Signed-out profile must expose normal receipt status entry")
  XCTAssertTrue(entry.isHittable);entry.tap()
  XCTAssertTrue(app.staticTexts["Check deletion status"].firstMatch.waitForExistence(timeout:12))
  let field=app.textFields["Deletion reference"];XCTAssertTrue(field.exists)
  XCTAssertEqual((field.value as? String) ?? "", "", "Fresh device has no saved personal receipt")
  let b=XCTAttachment(screenshot:app.screenshot());b.name="PUBLIC-fixed-guest-status-empty";b.lifetime = .keepAlways;add(b)
 }
}
