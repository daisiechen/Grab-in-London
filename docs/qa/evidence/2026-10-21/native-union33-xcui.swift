import XCTest
final class ProbeTests:XCTestCase {
 func testNativeRejoinedAuthorizedHistoryUnionExcludesGap() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:5){decline.tap()};app.buttons["Inbox, tab, 4 of 5"].tap();let group=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Native Cancellation Table")).firstMatch;XCTAssertTrue(group.waitForExistence(timeout:10));group.tap()
  XCTAssertTrue(app.staticTexts["QA Web after native rejoin."].firstMatch.waitForExistence(timeout:10),app.debugDescription);XCTAssertTrue(app.staticTexts["QA native confirmed cancellation."].firstMatch.exists);XCTAssertFalse(app.staticTexts["QA Web absence gap for native."].firstMatch.exists);XCTAssertTrue(app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","Message")).firstMatch.exists)
  print("QA_NATIVE_REJOIN_UNION_NO_GAP\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-rejoin-union-excludes-gap";a.lifetime = .keepAlways;add(a)
 }
}
