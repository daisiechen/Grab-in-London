import XCTest
final class ProbeTests:XCTestCase {
func testF63Photos208(){
continueAfterFailure=false
let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch()
let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:5){decline.tap()}
let card=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Synthetic photo verification,")).firstMatch
XCTAssertTrue(card.waitForExistence(timeout:12),app.debugDescription)
let list=app.otherElements["discover-list"].scrollViews.firstMatch
XCTAssertTrue(list.exists,app.debugDescription);list.swipeUp()
let author=app.links["Photo by Synthetic Author B"]
XCTAssertTrue(author.waitForExistence(timeout:8),app.debugDescription)
let a=XCTAttachment(screenshot:app.screenshot());a.name="f63-native-list-b-pixels";a.lifetime = .keepAlways;add(a)
XCTAssertTrue(card.isHittable,app.debugDescription);card.tap()
XCTAssertTrue(app.staticTexts["Synthetic photo verification"].firstMatch.waitForExistence(timeout:10),app.debugDescription)
XCTAssertTrue(author.waitForExistence(timeout:8),app.debugDescription)
let b=XCTAttachment(screenshot:app.screenshot());b.name="f63-native-detail-b-pixels";b.lifetime = .keepAlways;add(b)
print("F63_NATIVE_208_DETAIL\n"+app.debugDescription)
}
}
