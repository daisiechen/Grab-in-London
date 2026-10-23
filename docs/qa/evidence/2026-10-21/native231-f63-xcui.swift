import XCTest
final class ProbeTests:XCTestCase {
func testF63NormalLogin231(){
continueAfterFailure=false
let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch()
let create=app.buttons["Create meal"];XCTAssertTrue(create.waitForExistence(timeout:12),app.debugDescription);create.tap()
let email=app.buttons["Continue with email"];XCTAssertTrue(email.waitForExistence(timeout:8),app.debugDescription);email.tap()
let field=app.textFields["Email address"];XCTAssertTrue(field.waitForExistence(timeout:8),app.debugDescription);field.tap();XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout:5),app.debugDescription)
var typedEmail=""
for letter in "qa-f63-fault@example.test" {typedEmail.append(letter);field.typeText(String(letter));let expected=typedEmail;let retained=NSPredicate { _,_ in (field.value as? String)==expected };XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:retained,object:nil)],timeout:3),.completed,"Email input prefix lost at length \(expected.count)")}
XCTAssertEqual(field.value as? String,"qa-f63-fault@example.test")
app.buttons["Send code"].tap()
let code=app.textFields["6-digit code"];XCTAssertTrue(code.waitForExistence(timeout:10),app.debugDescription)
let docs=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0];let marker=docs.appendingPathComponent("f63-231-code")
XCTAssertFalse(FileManager.default.fileExists(atPath:marker.path))
print("F63_231_CODE_REQUIRED\n"+marker.path)
let ready=NSPredicate { _,_ in FileManager.default.fileExists(atPath:marker.path) }
XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:ready,object:nil)],timeout:90),.completed)
let otp=try! String(contentsOf:marker,encoding:.utf8);XCTAssertNotNil(otp.range(of:"^[0-9]{6}$",options:.regularExpression));code.tap();XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout:5),app.debugDescription)
var prefix=""
for digit in otp { prefix.append(digit);code.typeText(String(digit));let expected=prefix;let visible=NSPredicate { _,_ in (code.value as? String)==expected };XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:visible,object:nil)],timeout:3),.completed,"OTP field did not retain typed prefix length \(expected.count)") }
app.buttons["Verify & continue"].tap()
let title=app.staticTexts["Arrange your table"].firstMatch
XCTAssertTrue(title.waitForExistence(timeout:15),app.debugDescription)
let a=XCTAttachment(screenshot:app.screenshot());a.name="f63-native-normal-login-return-create";a.lifetime = .keepAlways;add(a)
print("F63_231_NORMAL_LOGIN_CREATE\n"+app.debugDescription)
}
}
