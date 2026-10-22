// Public copy: synthetic role email redacted; executed original retained privately.
import XCTest
final class ProbeTests:XCTestCase {
 func tap(_ app:XCUIApplication,_ name:String){let q=app.buttons.matching(identifier:name);XCTAssertTrue(q.firstMatch.waitForExistence(timeout:12),app.debugDescription);if q.count==1{q.firstMatch.tap();return};guard let b=q.allElementsBoundByIndex.first(where:{$0.isHittable})else{XCTFail("No hittable button "+name);return};b.tap()}
 func type(_ field:XCUIElement,_ value:String){field.tap();for c in value{field.typeText(String(c));Thread.sleep(forTimeInterval:0.15)}}
 func testJ010CancelledGroupStillReceivesAndSends() throws {
 continueAfterFailure=false
 let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();tap(app,"Inbox, tab, 4 of 5");let group=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA J010 insufficient table")).firstMatch;XCTAssertTrue(group.waitForExistence(timeout:15),app.debugDescription);print("QA_NATIVE93_INBOX_NOTIFICATION_ENTRY_INSPECTION\n"+app.debugDescription);let inbox=XCTAttachment(screenshot:app.screenshot());inbox.name="native93-inbox-notification-entry-absent";inbox.lifetime = .keepAlways;add(inbox);group.tap();XCTAssertTrue(app.staticTexts["QA J010 host: the cancelled table group remains available."].waitForExistence(timeout:15),app.debugDescription);let msg=app.textViews["Message"];XCTAssertTrue(msg.waitForExistence(timeout:10));type(msg,"QA J010 guest reply.");tap(app,"Send message");XCTAssertTrue(app.staticTexts["QA J010 guest reply."].waitForExistence(timeout:15),app.debugDescription);print("QA_NATIVE93_CANCELLED_GROUP_RECEIVE_AND_SEND\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native93-cancelled-group-receive-send";a.lifetime = .keepAlways;add(a)
 }
}
