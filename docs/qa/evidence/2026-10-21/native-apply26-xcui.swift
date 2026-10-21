import XCTest
final class ProbeTests:XCTestCase {
 func reveal(_ e:XCUIElement,_ app:XCUIApplication){for _ in 0..<6{if e.isHittable{return};app.scrollViews.firstMatch.swipeUp()}}
 func type(_ f:XCUIElement,_ s:String){f.tap();for c in s{f.typeText(String(c));Thread.sleep(forTimeInterval:0.15)}}
 func testApplyToInsufficientCrossTable() throws {
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();app.buttons["Discover, tab, 1 of 5"].tap()
  let card=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Insufficient Cross Table,")).firstMatch;XCTAssertTrue(card.waitForExistence(timeout:15),app.debugDescription);card.tap()
  let join=app.buttons["Request to join"];XCTAssertTrue(join.waitForExistence(timeout:15),app.debugDescription);reveal(join,app);join.tap()
  let heading=app.staticTexts["Pull up a chair."].firstMatch;XCTAssertTrue(heading.waitForExistence(timeout:10));let nav=app.navigationBars["Request to join"];print("QA_HEADER_GEOMETRY heading=\(heading.frame) nav=\(nav.frame)");XCTAssertGreaterThanOrEqual(heading.frame.minY,nav.frame.maxY)
  let intro=app.textViews["Your introduction"],text="Synthetic native guest for the insufficient table.";XCTAssertTrue(intro.waitForExistence(timeout:10));type(intro,text)
  let a=XCTAttachment(screenshot:app.screenshot());a.name="insufficient-native-unsent-introduction";a.lifetime = .keepAlways;add(a)
  app.navigationBars["Request to join"].buttons["Back"].tap();XCTAssertTrue(join.waitForExistence(timeout:10));reveal(join,app);join.tap();XCTAssertTrue(intro.waitForExistence(timeout:10));XCTAssertEqual(intro.value as? String,text);XCTAssertFalse(app.keyboards.firstMatch.exists)
  let send=app.buttons["Send request"];reveal(send,app);XCTAssertTrue(send.isHittable);send.tap();XCTAssertTrue(app.staticTexts["Application pending"].firstMatch.waitForExistence(timeout:15),app.debugDescription)
  print("QA_NATIVE_APPLICATION_PENDING\n"+app.debugDescription);let b=XCTAttachment(screenshot:app.screenshot());b.name="insufficient-native-application-pending";b.lifetime = .keepAlways;add(b)
 }
}
