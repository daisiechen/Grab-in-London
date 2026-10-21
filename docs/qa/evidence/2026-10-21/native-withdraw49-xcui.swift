import XCTest
final class ProbeTests:XCTestCase {
 func testNativeWithdrawMakesDirectHistoryReadOnly() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.activate();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:2){decline.tap()}
  app.buttons["Meals, tab, 2 of 5"].tap();app.otherElements["Past"].tap();let meal=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Cross-client Thursday Table,")).firstMatch;XCTAssertTrue(meal.waitForExistence(timeout:12));meal.tap();app.buttons["After the meal"].tap();let undo=app.buttons["Undo choice for QA Cross Host"];XCTAssertTrue(undo.waitForExistence(timeout:10),app.debugDescription);undo.tap();XCTAssertTrue(app.staticTexts["Choice saved privately."].firstMatch.waitForExistence(timeout:10));XCTAssertTrue(app.staticTexts["QA Cross Host · Not chosen"].firstMatch.exists)
  app.buttons["Inbox, tab, 4 of 5"].tap();let chat=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Cross Host,")).firstMatch;XCTAssertTrue(chat.waitForExistence(timeout:10),app.debugDescription);chat.tap();XCTAssertTrue(app.staticTexts["QA mutual connection hello."].firstMatch.waitForExistence(timeout:10));XCTAssertTrue(app.staticTexts["QA native mutual reply."].firstMatch.exists);XCTAssertFalse(app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","Message")).firstMatch.exists);print("QA_NATIVE_WITHDRAW_READONLY\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-withdraw-direct-readonly";a.lifetime = .keepAlways;add(a)
 }
}
