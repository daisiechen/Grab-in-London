import XCTest
final class ProbeTests:XCTestCase {
 func testFormalNativeHostExplicitDissolutionRetainsDraftAndHistory() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:5){decline.tap()};app.buttons["Inbox, tab, 4 of 5"].tap();let group=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Native Reverse Table")).firstMatch;XCTAssertTrue(group.waitForExistence(timeout:10));group.tap()
  let dissolve=app.buttons["Dissolve group"];XCTAssertTrue(dissolve.waitForExistence(timeout:10),app.debugDescription);let input=app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","Message")).firstMatch;XCTAssertTrue(input.exists);input.tap();let draft="QA kept host dissolution draft.";for c in draft{input.typeText(String(c));Thread.sleep(forTimeInterval:0.15)}
  dissolve.tap();XCTAssertTrue(app.staticTexts["Dissolve this group?"].firstMatch.waitForExistence(timeout:8));app.buttons["Keep group"].tap();XCTAssertEqual(input.value as? String,draft);XCTAssertTrue(dissolve.exists)
  dissolve.tap();let confirm=app.buttons["Confirm dissolution"];XCTAssertTrue(confirm.waitForExistence(timeout:8));print("QA_NATIVE_HOST_DISSOLVE_CONFIRM\n"+app.debugDescription);confirm.tap()
  XCTAssertTrue(app.staticTexts["Group dissolved. Everyone’s earlier messages remain read-only."].firstMatch.waitForExistence(timeout:12),app.debugDescription);XCTAssertTrue(app.staticTexts["Unsent text: "+draft].firstMatch.exists);XCTAssertTrue(app.staticTexts["History is read-only."].firstMatch.exists);XCTAssertFalse(input.exists);XCTAssertFalse(dissolve.exists);XCTAssertTrue(app.staticTexts["QA after rejoin visible."].firstMatch.exists)
  print("QA_NATIVE_HOST_DISSOLVED_KEPT_DRAFT\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-formal-host-dissolved-kept-draft";a.lifetime = .keepAlways;add(a)
 }
}
