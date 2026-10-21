import XCTest
final class ProbeTests:XCTestCase {
 func testAReverseWithdrawColdReadOnly() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:3){decline.tap()};app.buttons["Inbox, tab, 4 of 5"].tap();let chat=app.buttons["QA Cross Host"];XCTAssertTrue(chat.waitForExistence(timeout:12),app.debugDescription);chat.tap();XCTAssertTrue(app.staticTexts["QA reverse-role mutual hello."].firstMatch.waitForExistence(timeout:12),app.debugDescription);XCTAssertTrue(app.staticTexts["QA native reverse-role reply."].firstMatch.exists);XCTAssertFalse(app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","Message")).firstMatch.exists);print("QA_NATIVE_REVERSE_WITHDRAW_READONLY\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-reverse-withdraw-readonly";a.lifetime = .keepAlways;add(a)
 }
 func testBOriginalSafetySurface() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:3){decline.tap()};app.buttons["Meals, tab, 2 of 5"].tap();app.otherElements["Past"].tap();let meal=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Cross-client Thursday Table,")).firstMatch;XCTAssertTrue(meal.waitForExistence(timeout:12),app.debugDescription);meal.tap();let host=app.buttons["Your host, QA Cross Host"];XCTAssertTrue(host.waitForExistence(timeout:8));host.tap();XCTAssertTrue(app.buttons["Report this profile"].waitForExistence(timeout:10),app.debugDescription);print("QA_NATIVE_F44_ORIGINAL_PROFILE\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-original-profile-no-block";a.lifetime = .keepAlways;add(a)
  app.buttons["Back"].tap();app.buttons["Back"].tap();app.buttons["Profile, tab, 5 of 5"].tap();app.buttons["Settings"].tap();XCTAssertTrue(app.staticTexts["Privacy & safety"].firstMatch.waitForExistence(timeout:8));print("QA_NATIVE_F44_ORIGINAL_SETTINGS\n"+app.debugDescription);let b=XCTAttachment(screenshot:app.screenshot());b.name="native-original-settings-no-unblock";b.lifetime = .keepAlways;add(b)
 }
}
