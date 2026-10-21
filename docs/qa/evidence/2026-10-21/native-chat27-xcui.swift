import XCTest
final class ProbeTests:XCTestCase {
 func testNativeHostSendsOnlyDuringGuestAbsence() throws {
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:5){decline.tap()};app.buttons["Inbox, tab, 4 of 5"].tap()
  let group=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Native Reverse Table")).firstMatch;XCTAssertTrue(group.waitForExistence(timeout:10),app.debugDescription);group.tap();XCTAssertTrue(app.staticTexts["QA chat remains after seat cancellation."].firstMatch.waitForExistence(timeout:10))
  let input=app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","Message")).firstMatch;XCTAssertTrue(input.waitForExistence(timeout:8));input.tap();for c in "QA absence gap hidden." {input.typeText(String(c));Thread.sleep(forTimeInterval:0.15)};app.buttons["Send"].tap();XCTAssertTrue(app.staticTexts["QA absence gap hidden."].firstMatch.waitForExistence(timeout:10),app.debugDescription)
  print("QA_NATIVE_REVERSE_ABSENCE_GAP\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-reverse-absence-gap";a.lifetime = .keepAlways;add(a)
 }
}
