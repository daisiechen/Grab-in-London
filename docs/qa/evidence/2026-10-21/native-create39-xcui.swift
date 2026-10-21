import XCTest
final class ProbeTests:XCTestCase {
 func reveal(_ e:XCUIElement,_ app:XCUIApplication){XCTAssertTrue(e.exists,app.debugDescription)}
 func type(_ s:String,_ e:XCUIElement){e.tap();for c in s{e.typeText(String(c));Thread.sleep(forTimeInterval:0.15)}}
 func testNativeHostCreatesIndependentNormalMeal() throws {
  continueAfterFailure=false
  let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch();let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:5){decline.tap()};app.buttons["Create meal"].tap();XCTAssertTrue(app.staticTexts["Arrange your table"].waitForExistence(timeout:10))
  let search=app.textFields["Search restaurants"];type("Fancy",search);XCTAssertEqual(search.value as? String,"Fancy");search.typeText("\n");let north=app.buttons["Choose [Fixture] Fancy North Kitchen"];XCTAssertTrue(north.waitForExistence(timeout:10));north.tap();XCTAssertTrue(app.staticTexts["[Fixture] Fancy North Kitchen"].firstMatch.waitForExistence(timeout:8))
  let day=app.otherElements["Sat 24 Oct"].firstMatch;reveal(day,app);day.tap()
  let time=app.otherElements["00:00"].firstMatch;reveal(time,app);time.tap()
  let cap=app.otherElements["2"].firstMatch;reveal(cap,app);cap.tap();app.buttons["Continue"].tap()
  XCTAssertTrue(app.staticTexts["Introduce your meal"].waitForExistence(timeout:8),app.debugDescription)
  let title=app.textFields["Give your meal a name"];type("QA Native Normal Table",title)
  app.navigationBars.buttons["Back"].tap();XCTAssertTrue(app.staticTexts["Arrange your table"].waitForExistence(timeout:8));app.buttons["Continue"].tap();XCTAssertTrue(title.waitForExistence(timeout:8));XCTAssertEqual(title.value as? String,"QA Native Normal Table")
  let desc=app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","What should people expect?")).firstMatch;type("Synthetic normal hosted table.",desc)
  app.navigationBars.buttons["Back"].tap();XCTAssertTrue(app.staticTexts["Arrange your table"].waitForExistence(timeout:8));app.buttons["Continue"].tap()
  XCTAssertTrue(title.waitForExistence(timeout:8));XCTAssertEqual(title.value as? String,"QA Native Normal Table");XCTAssertEqual(desc.value as? String,"Synthetic normal hosted table.")
  let mood=app.otherElements["Easy conversation"];reveal(mood,app);mood.tap();let lang=app.otherElements["English"];reveal(lang,app);lang.tap();app.buttons["Continue"].tap()
  XCTAssertTrue(app.staticTexts["Keeping costs clear"].waitForExistence(timeout:8),app.debugDescription)
  let low=app.textFields["Budget from / person (£)"],high=app.textFields["Budget to / person (£)"];type("15",low);app.navigationBars.buttons["Back"].tap();XCTAssertTrue(app.staticTexts["Introduce your meal"].waitForExistence(timeout:8));app.buttons["Continue"].tap();XCTAssertTrue(high.waitForExistence(timeout:8));type("30",high)
  app.navigationBars.buttons["Back"].tap();XCTAssertTrue(app.staticTexts["Introduce your meal"].waitForExistence(timeout:8));app.buttons["Continue"].tap();XCTAssertTrue(low.waitForExistence(timeout:8));XCTAssertEqual(low.value as? String,"15");XCTAssertEqual(high.value as? String,"30")
  app.otherElements["I’ll reserve the table with the restaurant myself and keep guests updated if anything changes."].tap();app.buttons["Continue"].tap();XCTAssertTrue(app.staticTexts["Review your meal"].waitForExistence(timeout:8),app.debugDescription)
  print("QA_NATIVE_REVERSE_REVIEW\n"+app.debugDescription)
  app.otherElements["I’ve reviewed these details. Guests see them when they apply."].tap();app.buttons["Publish meal"].tap()
  XCTAssertTrue(app.otherElements["meal-detail"].waitForExistence(timeout:12),app.debugDescription);XCTAssertTrue(app.staticTexts["QA Native Normal Table"].firstMatch.exists)
  print("QA_NATIVE_REVERSE_PUBLISHED\n"+app.debugDescription)
  let a=XCTAttachment(screenshot:app.screenshot());a.name="native-normal-published";a.lifetime = .keepAlways;add(a)
 }
}
