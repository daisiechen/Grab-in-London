import XCTest
final class ProbeTests:XCTestCase {
func testF63SignedInArrange213(){
continueAfterFailure=false
let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch()
let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:4){decline.tap()}
let profile=app.buttons["Profile, tab, 5 of 5"];XCTAssertTrue(profile.waitForExistence(timeout:10),app.debugDescription);profile.tap()
XCTAssertTrue(app.staticTexts["Synthetic Photo QA"].firstMatch.waitForExistence(timeout:10),app.debugDescription)
app.buttons["Create meal"].tap()
XCTAssertTrue(app.staticTexts["Arrange your table"].firstMatch.waitForExistence(timeout:10),app.debugDescription)
let a=XCTAttachment(screenshot:app.screenshot());a.name="f63-native-signed-in-arrange";a.lifetime = .keepAlways;add(a)
print("F63_NATIVE_213_ARRANGE\n"+app.debugDescription)
}
}
