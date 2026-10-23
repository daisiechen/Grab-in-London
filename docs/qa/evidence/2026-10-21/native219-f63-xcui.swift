import XCTest
final class ProbeTests:XCTestCase {
func testF63ProviderUnavailable219(){
continueAfterFailure=false
let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch()
let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:3){decline.tap()}
let list=app.otherElements["discover-list"].scrollViews.firstMatch;XCTAssertTrue(list.waitForExistence(timeout:10),app.debugDescription);list.swipeUp()
let card=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Synthetic photo verification,")).firstMatch
XCTAssertTrue(card.waitForExistence(timeout:10),app.debugDescription)
XCTAssertFalse(app.links["Photo by Synthetic Author B"].exists,app.debugDescription)
let a=XCTAttachment(screenshot:app.screenshot());a.name="f63-native-provider-unavailable-list";a.lifetime = .keepAlways;add(a)
XCTAssertTrue(card.isHittable,app.debugDescription);card.tap()
let detail=app.otherElements["meal-detail"].scrollViews.firstMatch;XCTAssertTrue(detail.waitForExistence(timeout:10),app.debugDescription);detail.swipeUp()
XCTAssertFalse(app.links["Photo by Synthetic Author B"].exists,app.debugDescription)
let b=XCTAttachment(screenshot:app.screenshot());b.name="f63-native-provider-unavailable-detail";b.lifetime = .keepAlways;add(b)
print("F63_219_PROVIDER_UNAVAILABLE_DETAIL\n"+app.debugDescription)
}
}
