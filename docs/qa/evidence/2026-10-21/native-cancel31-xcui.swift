import XCTest
final class ProbeTests:XCTestCase {
 func tapVisible(_ label:String,_ app:XCUIApplication){let q=app.buttons.matching(identifier:label);let predicate=NSPredicate{_,_ in q.allElementsBoundByIndex.contains(where:{$0.isHittable})};XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:predicate,object:app)],timeout:8),.completed,app.debugDescription);q.allElementsBoundByIndex.first(where:{$0.isHittable})!.tap()}
 func testNativeGuestSeparatesSeatCancellationAndGroupLeave() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:5){decline.tap()};app.buttons["Discover, tab, 1 of 5"].tap()
  let card=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Native Cancellation Table,")).firstMatch;XCTAssertTrue(card.waitForExistence(timeout:12));card.tap();XCTAssertTrue(app.staticTexts["Your seat is confirmed"].firstMatch.waitForExistence(timeout:10))
  app.buttons["Cancel my place"].tap();XCTAssertTrue(app.staticTexts["Cancel your place?"].firstMatch.waitForExistence(timeout:8));tapVisible("Cancel my place",app)
  XCTAssertTrue(app.staticTexts["Participation cancelled"].firstMatch.waitForExistence(timeout:10),app.debugDescription);print("QA_NATIVE_SEAT_CANCELLED_GROUP_RETAINED\n"+app.debugDescription)
  app.buttons["Open group chat"].tap();let input=app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","Message")).firstMatch;XCTAssertTrue(input.waitForExistence(timeout:10));input.tap();for c in "QA native confirmed cancellation." {input.typeText(String(c));Thread.sleep(forTimeInterval:0.15)};app.buttons["Send"].tap();XCTAssertTrue(app.staticTexts["QA native confirmed cancellation."].firstMatch.waitForExistence(timeout:8));let a=XCTAttachment(screenshot:app.screenshot());a.name="native-cancel-seat-still-send";a.lifetime = .keepAlways;add(a)
  app.navigationBars.buttons["Back"].tap();XCTAssertTrue(app.buttons["Open group chat"].waitForExistence(timeout:8));app.buttons["Open group chat"].tap();XCTAssertTrue(app.buttons["Leave group"].waitForExistence(timeout:8));app.buttons["Leave group"].tap();XCTAssertTrue(app.staticTexts["Leave this group?"].firstMatch.waitForExistence(timeout:8));tapVisible("Leave group",app)
  XCTAssertTrue(app.staticTexts["History is read-only."].firstMatch.waitForExistence(timeout:10),app.debugDescription);XCTAssertFalse(input.exists);XCTAssertTrue(app.staticTexts["QA native confirmed cancellation."].firstMatch.exists);print("QA_NATIVE_EXPLICIT_LEFT_READONLY\n"+app.debugDescription);let b=XCTAttachment(screenshot:app.screenshot());b.name="native-left-group-readonly";b.lifetime = .keepAlways;add(b)
 }
}
