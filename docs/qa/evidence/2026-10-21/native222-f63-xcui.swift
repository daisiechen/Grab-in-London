import XCTest
final class ProbeTests:XCTestCase {
func testF63AuthorLoaded222(){
continueAfterFailure=false
let safari=XCUIApplication(bundleIdentifier:"com.apple.mobilesafari");safari.activate()
let loaded=safari.otherElements.matching(NSPredicate(format:"identifier BEGINSWITH %@ AND identifier CONTAINS %@","TabDocument?","IsPageLoaded=true")).firstMatch
XCTAssertTrue(loaded.waitForExistence(timeout:20),safari.debugDescription)
let body=safari.staticTexts.containing(NSPredicate(format:"label CONTAINS %@","Synthetic restaurant-photo UI fixtures")).firstMatch
XCTAssertTrue(body.exists,safari.debugDescription);XCTAssertTrue(body.isHittable,safari.debugDescription)
let a=XCTAttachment(screenshot:safari.screenshot());a.name="f63-author-loaded-body";a.lifetime = .keepAlways;add(a)
print("F63_222_LOADED\n"+safari.debugDescription)
XCUIApplication(bundleIdentifier:"com.example.fancy.dev").activate()
}
}
