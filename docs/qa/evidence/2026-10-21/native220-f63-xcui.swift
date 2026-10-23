import XCTest
final class ProbeTests:XCTestCase {
func typeExact(_ field:XCUIElement,_ text:String,_ app:XCUIApplication){
XCTAssertTrue(field.waitForExistence(timeout:8),app.debugDescription);field.tap();XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout:5),app.debugDescription)
var prefix="";for letter in text {prefix.append(letter);field.typeText(String(letter));let expected=prefix;let ok=NSPredicate { _,_ in (field.value as? String)==expected };XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:ok,object:nil)],timeout:3),.completed,"Input prefix lost at length \(expected.count)")}
}
func visibleTap(_ el:XCUIElement,_ scroll:XCUIElement,_ app:XCUIApplication){XCTAssertTrue(el.waitForExistence(timeout:10),app.debugDescription);var n=0;while !el.isHittable && n<4 {scroll.swipeUp();n+=1};XCTAssertTrue(el.isHittable,app.debugDescription);el.tap()}
func testF63CreatePreview220(){
continueAfterFailure=false
let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch()
let decline=app.buttons["Decline analytics"];if decline.waitForExistence(timeout:3){decline.tap()}
app.buttons["Create meal"].tap()
let screen=app.otherElements["create-step-0"].scrollViews.firstMatch;XCTAssertTrue(screen.waitForExistence(timeout:10),app.debugDescription)
let q=app.textFields["Search restaurants"];typeExact(q,"Geometry",app);q.typeText("\n")
let choice=app.buttons["Choose [Synthetic QA] Green Geometry Table"];visibleTap(choice,screen,app)
XCTAssertTrue(app.staticTexts["[Synthetic QA] Green Geometry Table"].firstMatch.waitForExistence(timeout:8),app.debugDescription)
visibleTap(app.otherElements["Sat 24 Oct"].firstMatch,screen,app)
visibleTap(app.otherElements["00:00"].firstMatch,screen,app)
app.buttons["Continue"].tap()
XCTAssertTrue(app.staticTexts["Introduce your meal"].firstMatch.waitForExistence(timeout:8),app.debugDescription)
typeExact(app.textFields["Give your meal a name"],"QA F63",app)
typeExact(app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","What should people expect?")).firstMatch,"Only synthetic QA data.",app)
app.staticTexts["Introduce your meal"].firstMatch.tap()
let intro=app.otherElements["create-step-1"].scrollViews.firstMatch
visibleTap(app.otherElements["Easy conversation"].firstMatch,intro,app)
visibleTap(app.otherElements["English"].firstMatch,intro,app)
app.buttons["Continue"].tap()
XCTAssertTrue(app.staticTexts["Keeping costs clear"].firstMatch.waitForExistence(timeout:8),app.debugDescription)
typeExact(app.textFields["Budget from / person (£)"],"20",app)
typeExact(app.textFields["Budget to / person (£)"],"30",app)
app.staticTexts["Keeping costs clear"].firstMatch.tap()
let costs=app.otherElements["create-step-2"].scrollViews.firstMatch
let booking=app.otherElements.matching(NSPredicate(format:"label BEGINSWITH %@","I have already booked a table at")).firstMatch
visibleTap(booking,costs,app);app.buttons["Continue"].tap()
XCTAssertTrue(app.images["Photo of [Synthetic QA] Green Geometry Table"].waitForExistence(timeout:10),app.debugDescription)
let a=XCTAttachment(screenshot:app.screenshot());a.name="f63-native-create-preview-a";a.lifetime = .keepAlways;add(a)
print("F63_220_CREATE_PREVIEW_A\n"+app.debugDescription)
let review=app.otherElements["create-step-3"].scrollViews.firstMatch
visibleTap(app.buttons["Edit arrangement"],review,app)
XCTAssertTrue(screen.waitForExistence(timeout:8),app.debugDescription)
let again=app.textFields["Search restaurants"]
if (again.value as? String) != "Geometry" {typeExact(again,"Geometry",app)} else {again.tap()}
again.typeText("\n")
visibleTap(app.buttons["Choose [Synthetic QA] Purple Geometry Table"],screen,app)
XCTAssertTrue(app.staticTexts["[Synthetic QA] Purple Geometry Table"].firstMatch.waitForExistence(timeout:8),app.debugDescription)
app.buttons["Continue"].tap()
XCTAssertTrue(app.staticTexts["Introduce your meal"].firstMatch.waitForExistence(timeout:8),app.debugDescription)
XCTAssertEqual(app.textFields["Give your meal a name"].value as? String,"QA F63")
app.buttons["Continue"].tap()
XCTAssertTrue(app.staticTexts["Keeping costs clear"].firstMatch.waitForExistence(timeout:8),app.debugDescription)
let newBooking=app.otherElements.matching(NSPredicate(format:"label BEGINSWITH %@","I have already booked a table at")).firstMatch
visibleTap(newBooking,app.otherElements["create-step-2"].scrollViews.firstMatch,app)
app.buttons["Continue"].tap()
XCTAssertTrue(app.images["Photo of [Synthetic QA] Purple Geometry Table"].waitForExistence(timeout:10),app.debugDescription)
XCTAssertFalse(app.images["Photo of [Synthetic QA] Green Geometry Table"].exists,app.debugDescription)
XCTAssertFalse(app.links["Photo by Synthetic Author A"].exists,app.debugDescription)
XCTAssertTrue(app.links["Photo by Synthetic Author B"].exists,app.debugDescription)
let b=XCTAttachment(screenshot:app.screenshot());b.name="f63-native-create-switched-b";b.lifetime = .keepAlways;add(b)
print("F63_220_SWITCHED_B\n"+app.debugDescription)

}
}
