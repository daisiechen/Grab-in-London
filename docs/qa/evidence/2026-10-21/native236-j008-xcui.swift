import XCTest
final class ProbeTests:XCTestCase {
func testJ008CurrentH236(){
continueAfterFailure=false
let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch()
let p=app.buttons["Profile, tab, 5 of 5"];XCTAssertTrue(p.waitForExistence(timeout:12),app.debugDescription);p.tap()
XCTAssertTrue(app.staticTexts["QA Final Host"].firstMatch.waitForExistence(timeout:12),app.debugDescription)
print("J008_236_CURRENT_H_PROFILE\n"+app.debugDescription)
app.buttons["Discover, tab, 1 of 5"].tap()
XCTAssertTrue(app.otherElements["discover-list"].waitForExistence(timeout:10),app.debugDescription)
print("J008_236_CURRENT_DISCOVER\n"+app.debugDescription)
let a=XCTAttachment(screenshot:app.screenshot());a.name="j008-current-sourceb-discover";a.lifetime = .keepAlways;add(a)
}
}
