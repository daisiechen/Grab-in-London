import XCTest
final class ProbeTests:XCTestCase {
 func testFixedNativeHostAttendanceCancelConfirmation() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:3){decline.tap()}
  app.buttons["Meals, tab, 2 of 5"].tap();app.otherElements["Past"].tap();let meal=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Native Normal Table,")).firstMatch;XCTAssertTrue(meal.waitForExistence(timeout:12),app.debugDescription);meal.tap();app.buttons["After the meal"].tap();XCTAssertTrue(app.staticTexts["You · Came · they reported"].firstMatch.waitForExistence(timeout:12),app.debugDescription)
  let choose=app.buttons["I’d meet QA Cross Host again"];XCTAssertTrue(choose.waitForExistence(timeout:10),app.debugDescription);choose.tap();XCTAssertTrue(app.staticTexts["Choice saved privately."].firstMatch.waitForExistence(timeout:10),app.debugDescription);XCTAssertTrue(app.staticTexts["QA Cross Host · You chose to meet again"].firstMatch.exists);print("QA_NATIVE_NORMAL_NEW_WINDOW_ONE_SIDED\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-normal-one-sided-retry-only";a.lifetime = .keepAlways;add(a)
 }
}
