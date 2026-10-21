import XCTest
final class ProbeTests:XCTestCase {
 func testOriginalNativeHostAttendanceSurface() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:3){decline.tap()}
  app.buttons["Meals, tab, 2 of 5"].tap();app.otherElements["Past"].tap();let meal=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Native Normal Table,")).firstMatch;XCTAssertTrue(meal.waitForExistence(timeout:12),app.debugDescription);meal.tap();app.buttons["After the meal"].tap();XCTAssertTrue(app.staticTexts["You · Not reported yet"].firstMatch.waitForExistence(timeout:12),app.debugDescription);print("QA_NATIVE_ORIGINAL_F42_HOST_SURFACE\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-original-host-attendance-missing";a.lifetime = .keepAlways;add(a)
 }
}
