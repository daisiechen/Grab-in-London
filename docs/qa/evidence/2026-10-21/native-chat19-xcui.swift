import XCTest
final class ProbeTests:XCTestCase {
 func testFormalChatHeaderAndRemoteMessagesAfterColdRestore() throws {
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:8){decline.tap()};app.buttons["Inbox, tab, 4 of 5"].tap()
  let group=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Cross-client Thursday Table")).firstMatch;XCTAssertTrue(group.waitForExistence(timeout:12),app.debugDescription);group.tap()
  let title=app.staticTexts["QA Cross-client Thursday Table"].firstMatch;XCTAssertTrue(title.waitForExistence(timeout:10));let nav=app.navigationBars["Chat"],leave=app.buttons["Leave group"]
  print("QA_CHAT_HEADER_GEOMETRY title=\(title.frame) leave=\(leave.frame) nav=\(nav.frame)");XCTAssertGreaterThanOrEqual(title.frame.minY,nav.frame.maxY);XCTAssertGreaterThanOrEqual(leave.frame.minY,nav.frame.maxY)
  XCTAssertTrue(app.staticTexts["QA native hello"].firstMatch.waitForExistence(timeout:10));XCTAssertTrue(app.staticTexts["QA web hello"].firstMatch.waitForExistence(timeout:10));print("QA_NATIVE_REMOTE_TWO_MESSAGES\n"+app.debugDescription)
  let a=XCTAttachment(screenshot:app.screenshot());a.name="formal-native-chat-header-remote-messages";a.lifetime = .keepAlways;add(a)
 }
}
