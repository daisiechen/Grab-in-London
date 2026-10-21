import XCTest
final class ProbeTests:XCTestCase {
 func testNativeHostApprovesSecondRoundAndSendsNewSegment() throws {
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:5){decline.tap()};app.buttons["Discover, tab, 1 of 5"].tap()
  let card=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Native Reverse Table,")).firstMatch;XCTAssertTrue(card.waitForExistence(timeout:12),app.debugDescription);card.tap()
  let manage=app.buttons["Manage your table"];XCTAssertTrue(manage.waitForExistence(timeout:10));manage.tap()
  let approve=app.buttons["Approve QA Cross Host"];XCTAssertTrue(approve.waitForExistence(timeout:12),app.debugDescription);print("QA_REVERSE_NATIVE_PENDING\n"+app.debugDescription);approve.tap()
  XCTAssertTrue(app.staticTexts["Requests · 0"].firstMatch.waitForExistence(timeout:10),app.debugDescription)
  print("QA_REVERSE_NATIVE_APPROVED_STALE\n"+app.debugDescription)
  let update=app.buttons["Update reservation"];XCTAssertTrue(update.waitForExistence(timeout:8));update.tap();let booked=app.otherElements["Booked"];XCTAssertTrue(booked.waitForExistence(timeout:8));booked.tap();app.buttons["Save reservation status"].tap()
  XCTAssertTrue(app.staticTexts["Reservation status updated."].firstMatch.waitForExistence(timeout:10),app.debugDescription)
  print("QA_REVERSE_NATIVE_BOOKING_RECONFIRMED\n"+app.debugDescription)
  app.navigationBars.buttons["Back"].tap();let group=app.buttons["Open group chat"];XCTAssertTrue(group.waitForExistence(timeout:8));group.tap();let input=app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","Message")).firstMatch;XCTAssertTrue(input.waitForExistence(timeout:8));input.tap();for c in "QA after rejoin visible." {input.typeText(String(c));Thread.sleep(forTimeInterval:0.15)};app.buttons["Send"].tap();XCTAssertTrue(app.staticTexts["QA after rejoin visible."].firstMatch.waitForExistence(timeout:10));print("QA_REJOIN_NATIVE_NEW_SEGMENT\n"+app.debugDescription)
  let a=XCTAttachment(screenshot:app.screenshot());a.name="native-reverse-rejoined-new-segment";a.lifetime = .keepAlways;add(a)
 }
}
