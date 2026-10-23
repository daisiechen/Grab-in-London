import XCTest
final class ProbeTests:XCTestCase {
func tapVisible(_ e:XCUIElement,_ s:XCUIElement,_ a:XCUIApplication){var n=0;while !e.isHittable&&n<4{s.swipeUp();n+=1};XCTAssertTrue(e.isHittable,a.debugDescription);e.tap()}
func testF63Mismatch233(){
continueAfterFailure=false
let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.activate()
let review=app.otherElements["create-step-3"].scrollViews.firstMatch;XCTAssertTrue(review.waitForExistence(timeout:10),app.debugDescription)
tapVisible(app.buttons["Edit costs"],review,app)
XCTAssertTrue(app.staticTexts["Keeping costs clear"].firstMatch.waitForExistence(timeout:8),app.debugDescription)
app.buttons["Continue"].tap()
XCTAssertTrue(app.staticTexts["Review your meal"].firstMatch.waitForExistence(timeout:10),app.debugDescription)
let marker=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0].appendingPathComponent("f63-233-mismatch-complete")
XCTAssertFalse(FileManager.default.fileExists(atPath:marker.path));print("F63_233_MISMATCH_WAIT\n"+marker.path)
let ready=NSPredicate{_,_ in FileManager.default.fileExists(atPath:marker.path)};XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:ready,object:nil)],timeout:90),.completed)
XCTAssertTrue(app.staticTexts["Restaurant photo unavailable"].firstMatch.exists,app.debugDescription)
XCTAssertFalse(app.images["Photo of [Synthetic QA] Green Geometry Table"].exists)
XCTAssertFalse(app.links["Photo by Synthetic Author A"].exists)
let a=XCTAttachment(screenshot:app.screenshot());a.name="f63-native-place-mismatch";a.lifetime = .keepAlways;add(a)
}
}
