import XCTest
final class ProbeTests:XCTestCase {
func testNativeJ008Prepare202(){
continueAfterFailure=false
let app=XCUIApplication(bundleIdentifier:"com.example.fancy.dev");app.launch()
let profile=app.buttons["Profile, tab, 5 of 5"]
XCTAssertTrue(profile.waitForExistence(timeout:12),app.debugDescription);profile.tap()
XCTAssertTrue(app.staticTexts["QA Final Host"].firstMatch.waitForExistence(timeout:12),app.debugDescription)
let inbox=app.buttons["Inbox, tab, 3 of 5"]
XCTAssertTrue(inbox.waitForExistence(timeout:8),app.debugDescription);inbox.tap()
let loaded=app.otherElements.matching(NSPredicate(format:"label BEGINSWITH %@","Chats · ")).firstMatch
XCTAssertTrue(loaded.waitForExistence(timeout:12),app.debugDescription)
XCTAssertFalse(app.buttons["Retry loading inbox"].exists,app.debugDescription)
let a=XCTAttachment(screenshot:app.screenshot());a.name="codex-j008-normal-h-inbox-before-offline";a.lifetime = .keepAlways;add(a)
print("QA_CODEX_J008_PREPARE_LOADED_H_INBOX\n"+app.debugDescription)
}
}
