import XCTest
final class ProbeTests:XCTestCase {
func testF63AuthorBody221(){
continueAfterFailure=false
let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch()
let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:3){decline.tap()}
let list=app.otherElements["discover-list"].scrollViews.firstMatch;XCTAssertTrue(list.waitForExistence(timeout:10),app.debugDescription);list.swipeUp()
let author=app.links["Photo by Synthetic Author B"];XCTAssertTrue(author.waitForExistence(timeout:10),app.debugDescription)
XCTAssertTrue(author.isHittable,app.debugDescription);author.tap()
let safari=XCUIApplication(bundleIdentifier:"com.apple.mobilesafari")
XCTAssertTrue(safari.wait(for:.runningForeground,timeout:12),"Author link did not open Safari")
let body=safari.staticTexts.containing(NSPredicate(format:"label CONTAINS %@","Synthetic restaurant-photo UI fixtures")).firstMatch
XCTAssertTrue(body.waitForExistence(timeout:20),safari.debugDescription)
let a=XCTAttachment(screenshot:safari.screenshot());a.name="f63-native-author-readme-body";a.lifetime = .keepAlways;add(a)
print("F63_221_AUTHOR_BODY\n"+safari.debugDescription)
app.activate()
XCTAssertTrue(list.waitForExistence(timeout:8),app.debugDescription)
let card=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Synthetic photo verification,")).firstMatch
XCTAssertTrue(card.isHittable,app.debugDescription);card.tap()
let detail=app.otherElements["meal-detail"].scrollViews.firstMatch;XCTAssertTrue(detail.waitForExistence(timeout:10),app.debugDescription)
detail.swipeUp()
XCTAssertTrue(author.waitForExistence(timeout:8),app.debugDescription);XCTAssertTrue(author.isHittable,app.debugDescription)
let b=XCTAttachment(screenshot:app.screenshot());b.name="f63-native-detail-visible-author";b.lifetime = .keepAlways;add(b)
print("F63_214_VISIBLE_DETAIL_AUTHOR\n"+app.debugDescription)
}
}
