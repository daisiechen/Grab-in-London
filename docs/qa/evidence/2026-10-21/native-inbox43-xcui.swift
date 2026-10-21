import XCTest
final class ProbeTests:XCTestCase {
 func testNormalRemoteMessagesAndAutomaticInboxReturn() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:5){decline.tap()};app.buttons["Inbox, tab, 4 of 5"].tap();let group=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Native Normal Table")).firstMatch;XCTAssertTrue(group.waitForExistence(timeout:10));group.tap();XCTAssertTrue(app.staticTexts["QA web normal hello."].firstMatch.waitForExistence(timeout:10));XCTAssertTrue(app.staticTexts["QA native normal hello."].firstMatch.exists);print("QA_NATIVE_NORMAL_REMOTE_TWO_MESSAGES\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-normal-two-remote-messages";a.lifetime = .keepAlways;add(a)
  app.navigationBars.buttons["Back"].tap();app.buttons["Inbox, tab, 4 of 5"].tap();XCTAssertTrue(group.waitForExistence(timeout:10),app.debugDescription);print("QA_NATIVE_AUTOMATIC_INBOX_RESTORED\n"+app.debugDescription);let b=XCTAttachment(screenshot:app.screenshot());b.name="native-inbox-automatic-return-restored";b.lifetime = .keepAlways;add(b)
 }
}
