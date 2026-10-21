import XCTest
final class ProbeTests:XCTestCase {
 func testNativePublicReferenceThenOneSidedChoiceWithoutRepeatedRating() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.activate();let reference=app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","Reference for QA Cross Host")).firstMatch
  if !reference.waitForExistence(timeout:3){let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:3){decline.tap()};app.buttons["Meals, tab, 2 of 5"].tap();app.otherElements["Past"].tap();let card=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","QA Cross-client Thursday Table,")).firstMatch;XCTAssertTrue(card.waitForExistence(timeout:12));card.tap();let after=app.buttons["After the meal"];XCTAssertTrue(after.waitForExistence(timeout:8));after.tap();XCTAssertTrue(reference.waitForExistence(timeout:8))}
  let body="QA public reference for a shared synthetic meal.";let old=reference.value as? String ?? "";if old.isEmpty{reference.tap();for c in body{reference.typeText(String(c));Thread.sleep(forTimeInterval:0.15)}}else{XCTAssertEqual(old,body)}
  app.staticTexts["After the meal"].firstMatch.tap();let save=app.buttons["Save reference for QA Cross Host"];XCTAssertTrue(save.exists);print("QA_NATIVE_REFERENCE_BEFORE_EXPLICIT_SAVE\n"+app.debugDescription);save.tap();XCTAssertTrue(app.staticTexts["Reference saved."].firstMatch.waitForExistence(timeout:10),app.debugDescription)
  app.buttons["I’d meet QA Cross Host again"].tap();XCTAssertTrue(app.staticTexts["Choice saved privately."].firstMatch.waitForExistence(timeout:10));XCTAssertTrue(app.buttons["Undo choice for QA Cross Host"].exists);XCTAssertTrue(app.staticTexts["QA Cross Host · You chose to meet again"].firstMatch.exists);print("QA_NATIVE_PUBLIC_REFERENCE_PRIVATE_ONE_SIDED\n"+app.debugDescription);let a=XCTAttachment(screenshot:app.screenshot());a.name="native-reference-private-one-sided";a.lifetime = .keepAlways;add(a)
 }
}
