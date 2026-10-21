import XCTest
final class ProbeTests:XCTestCase {
 func reveal(_ e:XCUIElement,_ app:XCUIApplication){for _ in 0..<6{if e.isHittable{return};app.scrollViews.firstMatch.swipeUp()}}
 func type(_ f:XCUIElement,_ s:String){f.tap();for c in s{f.typeText(String(c));Thread.sleep(forTimeInterval:0.15)}}
 func testNativeHistoryGapThenExplicitReapply() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:5){decline.tap()};app.buttons["Inbox, tab, 4 of 5"].tap();let old=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Native Cancellation Table")).firstMatch;XCTAssertTrue(old.waitForExistence(timeout:10));old.tap();XCTAssertTrue(app.staticTexts["History is read-only."].firstMatch.waitForExistence(timeout:10));XCTAssertTrue(app.staticTexts["QA native confirmed cancellation."].firstMatch.exists);XCTAssertFalse(app.staticTexts["QA Web absence gap for native."].firstMatch.exists);XCTAssertFalse(app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","Message")).firstMatch.exists);print("QA_NATIVE_ABSENCE_HISTORY\n"+app.debugDescription);app.navigationBars.buttons["Back"].tap();app.buttons["Discover, tab, 1 of 5"].tap()
  let card=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Native Cancellation Table,")).firstMatch;XCTAssertTrue(card.waitForExistence(timeout:15),app.debugDescription);card.tap()
  let join=app.buttons["Request to join"];XCTAssertTrue(join.waitForExistence(timeout:15),app.debugDescription);reveal(join,app);join.tap()
  let heading=app.staticTexts["Pull up a chair."].firstMatch;XCTAssertTrue(heading.waitForExistence(timeout:10));let nav=app.navigationBars["Request to join"];print("QA_HEADER_GEOMETRY heading=\(heading.frame) nav=\(nav.frame)");XCTAssertGreaterThanOrEqual(heading.frame.minY,nav.frame.maxY)
  let intro=app.textViews["Your introduction"],text="Synthetic native explicit second round.";XCTAssertTrue(intro.waitForExistence(timeout:10));type(intro,text)
  let a=XCTAttachment(screenshot:app.screenshot());a.name="cancellation-native-unsent-introduction";a.lifetime = .keepAlways;add(a)
  app.navigationBars["Request to join"].buttons["Back"].tap();XCTAssertTrue(join.waitForExistence(timeout:10));reveal(join,app);join.tap();XCTAssertTrue(intro.waitForExistence(timeout:10));XCTAssertEqual(intro.value as? String,text);XCTAssertFalse(app.keyboards.firstMatch.exists)
  let send=app.buttons["Send request"];reveal(send,app);XCTAssertTrue(send.isHittable);send.tap();XCTAssertTrue(app.staticTexts["Application pending"].firstMatch.waitForExistence(timeout:15),app.debugDescription)
  print("QA_NATIVE_APPLICATION_PENDING\n"+app.debugDescription);let b=XCTAttachment(screenshot:app.screenshot());b.name="cancellation-native-application-pending";b.lifetime = .keepAlways;add(b)
 }
}
