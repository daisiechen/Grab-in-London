import XCTest
final class ProbeTests:XCTestCase {
 func tap(_ app:XCUIApplication,_ name:String){let matches=app.buttons.matching(identifier:name);XCTAssertTrue(matches.firstMatch.waitForExistence(timeout:10),app.debugDescription);guard let visible=matches.allElementsBoundByIndex.first(where:{$0.isHittable})else{XCTFail("No hittable button: "+name);return};visible.tap()}
 func testF44CancelUnblockKeepsBlockedState() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:3){decline.tap()};tap(app,"Meals, tab, 2 of 5");app.otherElements["Past"].tap();let meal=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","F44 shared table,")).firstMatch;XCTAssertTrue(meal.waitForExistence(timeout:12),app.debugDescription);meal.tap();tap(app,"Your host, F44 Host");let block=app.buttons["Unblock F44 Host"];XCTAssertTrue(block.waitForExistence(timeout:12),app.debugDescription);block.tap();XCTAssertTrue(app.buttons["Confirm unblock"].waitForExistence(timeout:5));tap(app,"Cancel");XCTAssertFalse(app.buttons["Confirm unblock"].exists);XCTAssertTrue(app.buttons["Unblock F44 Host"].exists);print("QA_NATIVE_F44_CANCEL_UNBLOCK\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-f44-cancel-unblock";a.lifetime = .keepAlways;add(a)
 }
}
