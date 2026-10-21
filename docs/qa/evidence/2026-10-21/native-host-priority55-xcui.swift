import XCTest
final class ProbeTests:XCTestCase {
 func testFixedNativeHostAttendanceCancelConfirmation() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:3){decline.tap()}
  app.buttons["Meals, tab, 2 of 5"].tap();app.otherElements["Past"].tap();let meal=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Native Normal Table,")).firstMatch;XCTAssertTrue(meal.waitForExistence(timeout:12),app.debugDescription);meal.tap();app.buttons["After the meal"].tap();XCTAssertTrue(app.staticTexts["You · Not reported yet"].firstMatch.waitForExistence(timeout:12),app.debugDescription)
  XCTAssertTrue(app.staticTexts["QA Cross Host · Came · they reported"].firstMatch.waitForExistence(timeout:8),app.debugDescription)
  let review=app.buttons["Review attendance for QA Cross Host"];XCTAssertTrue(review.waitForExistence(timeout:12),app.debugDescription);app.otherElements["QA Cross Host didn’t come"].tap();review.tap();app.buttons["Confirm attendance report"].tap();XCTAssertTrue(app.staticTexts["Host report saved. Each member’s own report takes priority."].firstMatch.waitForExistence(timeout:12),app.debugDescription);XCTAssertTrue(app.staticTexts["QA Cross Host · Your host report: didn’t come"].firstMatch.exists);XCTAssertTrue(app.staticTexts["QA Cross Host · Came · they reported"].firstMatch.exists);print("QA_NATIVE_F42_SELF_PRIORITY\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-host-report-absent-confirmed";a.lifetime = .keepAlways;add(a)
 }
}
