import XCTest
final class ProbeTests:XCTestCase {
 func type(_ f:XCUIElement,_ s:String){f.tap();for c in s{f.typeText(String(c));Thread.sleep(forTimeInterval:0.15)}}
 func testApprovedNativeGuestSendsGroupMessage() throws {
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:8){decline.tap()};app.buttons["Inbox, tab, 4 of 5"].tap()
  XCTAssertTrue(app.otherElements["Chats · 1"].waitForExistence(timeout:12),app.debugDescription);let group=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Cross-client Thursday Table")).firstMatch;XCTAssertTrue(group.waitForExistence(timeout:10));group.tap()
  let field=app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","Message")).firstMatch;XCTAssertTrue(field.waitForExistence(timeout:12),app.debugDescription)
  print("QA_NATIVE_CHAT_BEFORE\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-group-before-compose";a.lifetime = .keepAlways;add(a)
  type(field,"QA native hello");let send=app.buttons["Send"];XCTAssertTrue(send.isHittable);send.tap()
  XCTAssertTrue(app.staticTexts["QA native hello"].firstMatch.waitForExistence(timeout:10),app.debugDescription);print("QA_NATIVE_GROUP_MESSAGE_VISIBLE\n"+app.debugDescription)
  let b=XCTAttachment(screenshot:app.screenshot());b.name="native-group-message-visible";b.lifetime = .keepAlways;add(b)
 }
}
