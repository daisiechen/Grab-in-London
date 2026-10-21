import XCTest
final class ProbeTests:XCTestCase {
 func testFixedNativeHostAttendanceCancelConfirmation() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:3){decline.tap()}
  app.buttons["Meals, tab, 2 of 5"].tap();app.otherElements["Past"].tap();let meal=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Native Normal Table,")).firstMatch;XCTAssertTrue(meal.waitForExistence(timeout:12),app.debugDescription);meal.tap();app.buttons["After the meal"].tap();XCTAssertTrue(app.staticTexts["You · Not reported yet"].firstMatch.waitForExistence(timeout:12),app.debugDescription)
  let review=app.buttons["Review attendance for QA Cross Host"];XCTAssertTrue(review.waitForExistence(timeout:12),app.debugDescription);XCTAssertFalse(review.isEnabled);XCTAssertTrue(app.staticTexts["QA Cross Host · Your host report: not reported"].firstMatch.exists)
  app.otherElements["QA Cross Host came"].tap();review.tap();XCTAssertTrue(app.buttons["Confirm attendance report"].waitForExistence(timeout:5));app.buttons["Keep editing"].tap();XCTAssertFalse(app.buttons["Confirm attendance report"].exists);XCTAssertTrue(app.staticTexts["QA Cross Host · Your host report: not reported"].firstMatch.exists);print("QA_NATIVE_F42_KEEP_EDITING_NO_WRITE\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-host-report-cancel-no-write";a.lifetime = .keepAlways;add(a)
 }
}
