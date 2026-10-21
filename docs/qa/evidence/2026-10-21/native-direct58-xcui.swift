import XCTest
final class ProbeTests:XCTestCase {
 func testNativeReverseRoleDirectMessageRoundTrip() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.activate();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:2){decline.tap()}
  app.buttons["Inbox, tab, 4 of 5"].tap();let card=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Cross Host")).firstMatch;XCTAssertTrue(card.waitForExistence(timeout:12),app.debugDescription);card.tap()
  XCTAssertTrue(app.staticTexts["QA reverse-role mutual hello."].firstMatch.waitForExistence(timeout:12),app.debugDescription)
  let input=app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","Message")).firstMatch;XCTAssertTrue(input.exists);input.tap();input.typeText("QA native reverse-role reply.");app.buttons["Send"].tap();XCTAssertTrue(app.staticTexts["QA native reverse-role reply."].firstMatch.waitForExistence(timeout:12),app.debugDescription)
  print("QA_NATIVE_DIRECT_ROUNDTRIP\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-reverse-direct-roundtrip";a.lifetime = .keepAlways;add(a)
 }
}
