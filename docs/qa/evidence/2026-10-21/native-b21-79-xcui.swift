import XCTest
final class ProbeTests:XCTestCase {
 func tap(_ app:XCUIApplication,_ name:String){let q=app.buttons.matching(identifier:name);XCTAssertTrue(q.firstMatch.waitForExistence(timeout:12),app.debugDescription);if q.count==1{q.firstMatch.tap();return};guard let b=q.allElementsBoundByIndex.first(where:{$0.isHittable})else{XCTFail("No hittable button "+name);return};b.tap()}
 func testNativeAssistantQuestionAndAskStayReachableWithKeyboard() throws {
 continueAfterFailure=false
 let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();tap(app,"Ask Fancy");tap(app,"Continue conversation");let q=app.textViews["Ask Fancy a question"];XCTAssertTrue(q.waitForExistence(timeout:12),app.debugDescription);q.tap();for c in "QAKEY79"{q.typeText(String(c));Thread.sleep(forTimeInterval:0.15)};let keyboard=app.keyboards.firstMatch;XCTAssertTrue(keyboard.waitForExistence(timeout:10),app.debugDescription);let ask=app.buttons["Ask"];print("QA_NATIVE79_KEYBOARD keyboard=\(keyboard.frame) question=\(q.frame) ask=\(ask.frame) questionHittable=\(q.isHittable) askHittable=\(ask.isHittable)\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native79-assistant-keyboard-reachability";a.lifetime = .keepAlways;add(a);XCTAssertTrue(ask.isHittable,"Ask must be physically reachable when the input keyboard is open; enabled alone is insufficient.");XCTAssertLessThanOrEqual(q.frame.maxY,keyboard.frame.minY,"Question field must be visible above the keyboard while typing.")
 }
}
