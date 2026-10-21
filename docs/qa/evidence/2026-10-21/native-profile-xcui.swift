import XCTest
final class ProbeTests:XCTestCase {
 func type(_ field:XCUIElement,_ value:String){field.tap();for c in value{field.typeText(String(c));Thread.sleep(forTimeInterval:0.15)}}
 func testCompleteNativeProfileAndDiscover() throws {
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch()
  let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:10){decline.tap()}
  app.buttons["Profile, tab, 5 of 5"].tap();let finish=app.buttons["Finish your profile"];if finish.waitForExistence(timeout:10){finish.tap()}
  let name=app.textFields["First name"];XCTAssertTrue(name.waitForExistence(timeout:15),app.debugDescription);type(name,"QA Native Guest")
  let bio=app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","A little about you")).firstMatch;type(bio,"Synthetic native guest for isolated cross-client testing.")
  app.staticTexts["A face. A little story. You."].firstMatch.tap()
  app.otherElements["New to London"].tap();app.otherElements["English"].tap()
  app.swipeUp();app.otherElements["Food"].tap();let consent=app.otherElements["I’m 18 or older and I’ll keep this community welcoming, respectful and friendship-first."]
  if !consent.isHittable{app.swipeUp()};consent.tap();app.buttons["Take your seat"].tap()
  XCTAssertTrue(app.buttons["Discover, tab, 1 of 5"].waitForExistence(timeout:15),app.debugDescription)
  app.buttons["Discover, tab, 1 of 5"].tap();print("QA_NATIVE_PROFILE_COMPLETE\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.lifetime = .keepAlways;add(a)
 }
}
