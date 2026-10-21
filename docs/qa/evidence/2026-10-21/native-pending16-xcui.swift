import XCTest
final class ProbeTests:XCTestCase {
 func testPendingInboxHasNoChat() throws {
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:5){decline.tap()}
  let inbox=app.buttons["Inbox, tab, 4 of 5"];XCTAssertTrue(inbox.waitForExistence(timeout:10),app.debugDescription);inbox.tap()
  let chats=app.otherElements["Chats · 0"],requests=app.otherElements["Applications & next steps · 1"];XCTAssertTrue(chats.waitForExistence(timeout:10),app.debugDescription);XCTAssertTrue(requests.exists);XCTAssertFalse(app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Cross-client Thursday Table")).firstMatch.exists)
  requests.tap();let pending=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Cross-client Thursday Table")).firstMatch;XCTAssertTrue(pending.waitForExistence(timeout:10),app.debugDescription);XCTAssertTrue(pending.label.contains("Application pending"))
  print("QA_NATIVE_PENDING_NO_CHAT\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-pending-next-step-no-chat";a.lifetime = .keepAlways;add(a)
 }
}
