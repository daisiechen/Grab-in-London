import XCTest
final class ProbeTests:XCTestCase {
 func testNativeColdWithdrawnDirectHistoryReadOnly() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:3){decline.tap()}
  app.buttons["Inbox, tab, 4 of 5"].tap();let chat=app.buttons["QA Cross Host"];XCTAssertTrue(chat.waitForExistence(timeout:12),app.debugDescription);chat.tap();XCTAssertTrue(app.staticTexts["QA mutual connection hello."].firstMatch.waitForExistence(timeout:12),app.debugDescription);XCTAssertTrue(app.staticTexts["QA native mutual reply."].firstMatch.exists);XCTAssertFalse(app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","Message")).firstMatch.exists);print("QA_NATIVE_WITHDRAW_COLD_READONLY\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-withdraw-direct-readonly";a.lifetime = .keepAlways;add(a)
 }
}
