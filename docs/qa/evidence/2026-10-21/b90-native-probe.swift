// DRAFT v2 (not built, not run). Independent QA probe for F64: accepted 202 with lost response → relaunch → receipt-only status.
// Target: formal F64 composition app (CDHash 4946f689…, API 127.0.0.1:62061) on Codex-exclusive simulator61DE680E with a NEW synthetic OWN user; no pre-existing receipt.
// Host side (f64-orchestrate.py) owns OTP delivery and the single frozen ios_fault_endpoint adapter; this test never sees tokens.
// Secrecy: the 43-char deletion receipt is a bearer capability. This test never prints app.debugDescription, field values or full
// failure trees; diagnostics use a redacted label summary. Full-screen shots of the status page are PRIVATE attachments (xcresult kept 0600);
// public-safe evidence is element-only shots of non-secret labels.
import XCTest
import Darwin

final class ProbeTests: XCTestCase {
  let bundle = "com.example.fancy.dev"
  /// Runner-private Documents of THIS runner on THIS simulator; the host only accepts markers from that exact container.
  var docs: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }
  static let runId = UUID().uuidString

  // ---- redaction ----
  static let secretLike = try! NSRegularExpression(pattern: "[A-Za-z0-9_-]{32,}")
  func redact(_ s: String) -> String {
    Self.secretLike.stringByReplacingMatches(in: s, range: NSRange(s.startIndex..., in: s), withTemplate: "<redacted>")
  }
  /// Button and static-text labels only (no values, no text fields), secret-like runs redacted. Replaces app.debugDescription.
  func summary(_ app: XCUIApplication) -> String {
    let b = app.buttons.allElementsBoundByIndex.prefix(40).map { "btn:" + redact($0.label) }
    let t = app.staticTexts.allElementsBoundByIndex.prefix(40).map { "txt:" + redact($0.label) }
    return (b + t).joined(separator: " | ")
  }

  // ---- helpers ----
  func element(_ app: XCUIApplication, _ name: String) -> XCUIElementQuery {
    let q = app.buttons.matching(identifier: name)
    return q.count > 0 ? q : app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", name))
  }
  func tap(_ app: XCUIApplication, _ name: String, timeout: TimeInterval = 12) {
    var q = element(app, name)
    if !q.firstMatch.waitForExistence(timeout: timeout) { q = element(app, name) }
    XCTAssertTrue(q.firstMatch.exists, "missing \(name) :: " + summary(app))
    var n = 0
    while !q.allElementsBoundByIndex.contains(where: { $0.isHittable }) && n < 8 {
      let sv = app.scrollViews.firstMatch
      if q.firstMatch.frame.midY < sv.frame.minY + 35 { sv.swipeDown() } else { sv.swipeUp() }
      n += 1
    }
    guard let b = q.allElementsBoundByIndex.first(where: { $0.isHittable }) else { XCTFail("not hittable \(name) :: " + summary(app)); return }
    b.tap()
  }
  func typeSlow(_ f: XCUIElement, _ v: String) {
    f.tap();var prefix=""
    for c in v { f.typeText(String(c)); prefix.append(c); Thread.sleep(forTimeInterval:0.12)
      if let actual=f.value as? String, actual != prefix { XCTFail("Input prefix mismatch at character count \(prefix.count)");return }
    }
  }
  func shot(_ app: XCUIApplication, _ name: String) { let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a) }
  func privateShot(_ app: XCUIApplication, _ name: String) { shot(app, "PRIVATE-" + name) }
  func elementShot(_ e: XCUIElement, _ name: String) { let a = XCTAttachment(screenshot: e.screenshot()); a.name = "PUBLIC-" + name; a.lifetime = .keepAlways; add(a) }
  /// Visible = inside the scroll view (or window) and hittable; existence alone is not user-visible evidence.
  @discardableResult
  func assertVisibleText(_ app: XCUIApplication, _ text: String, _ timeout: TimeInterval = 12) -> XCUIElement {
    let e = app.staticTexts[text].firstMatch
    XCTAssertTrue(e.waitForExistence(timeout: timeout), "missing text \(text) :: " + summary(app))
    let sv = app.scrollViews.firstMatch
    var n = 0
    func inView() -> Bool { let v = sv.exists ? sv.frame : app.windows.firstMatch.frame; return e.frame.minY >= v.minY + 8 && e.frame.maxY <= v.maxY - 8 && e.isHittable }
    while !inView() && n < 10 { if e.frame.midY < (sv.exists ? sv.frame.midY : 400) { sv.swipeDown(velocity: .slow) } else { sv.swipeUp(velocity: .slow) }; n += 1 }
    XCTAssertTrue(inView(), "text not visible \(text) frame=\(e.frame)")
    return e
  }

  // ---- host handshake: O_EXCL 0600 files in this runner's Documents, bound to runId + per-marker nonce ----
  func exclusiveWrite(_ url: URL, _ data: Data) throws {
    let fd = open(url.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600)
    guard fd >= 0 else { throw NSError(domain: "F64", code: Int(errno), userInfo: [NSLocalizedDescriptionKey: "O_EXCL create failed \(url.lastPathComponent)"]) }
    defer { close(fd) }
    let ok = data.withUnsafeBytes { write(fd, $0.baseAddress, data.count) == data.count }
    guard ok, fsync(fd) == 0 else { throw NSError(domain: "F64", code: 5, userInfo: [NSLocalizedDescriptionKey: "short write"]) }
  }
  func handshake(_ marker: String, timeout: TimeInterval = 240) throws -> [String: String] {
    let ready = docs.appendingPathComponent("f64-\(marker)-ready.json"), reply = docs.appendingPathComponent("f64-\(marker)-reply.json")
    // Stale reply or ready from an earlier run is a failure, not something to clean up silently.
    XCTAssertFalse(FileManager.default.fileExists(atPath: reply.path), "stale reply for \(marker)")
    XCTAssertFalse(FileManager.default.fileExists(atPath: ready.path), "stale ready for \(marker)")
    let nonce = UUID().uuidString
    try exclusiveWrite(ready, try JSONSerialization.data(withJSONObject: ["runId": Self.runId, "marker": marker, "nonce": nonce]))
    print("F64_READY_\(marker)=\(Self.runId):\(nonce)"); fflush(stdout)   // no path: host derives the container itself
    let until = Date().addingTimeInterval(timeout)
    while !FileManager.default.fileExists(atPath: reply.path) && Date() < until { Thread.sleep(forTimeInterval: 0.25) }
    XCTAssertTrue(FileManager.default.fileExists(atPath: reply.path), "host did not answer \(marker)")
    let attrs = try FileManager.default.attributesOfItem(atPath: reply.path)
    XCTAssertEqual(attrs[.type] as? FileAttributeType, .typeRegular, "reply not a regular file")
    XCTAssertEqual((attrs[.posixPermissions] as? NSNumber)?.intValue, 0o600, "reply mode not 0600")
    let data = try Data(contentsOf: reply)
    try FileManager.default.removeItem(at: reply); try FileManager.default.removeItem(at: ready)
    let obj = (try JSONSerialization.jsonObject(with: data) as? [String: String]) ?? [:]
    XCTAssertEqual(obj["runId"], Self.runId, "reply runId mismatch \(marker)")
    XCTAssertEqual(obj["nonce"], nonce, "reply nonce mismatch \(marker)")
    if let err = obj["error"] { XCTFail("host refused \(marker): \(redact(err))") }
    return obj
  }
  func declineAnalytics(_ app: XCUIApplication) { let d = app.buttons["Decline analytics"]; if d.waitForExistence(timeout: 5) { d.tap() } }

  // ---- step 1: fresh synthetic OWN user signs in and COMPLETES the normal profile setup, then reaches Settings ----
  func test1_SignInAndCompleteProfile() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: bundle); app.terminate(); app.launch(); declineAnalytics(app)
    tap(app, "Profile, tab, 5 of 5")
    if app.buttons["Sign in or create an account"].waitForExistence(timeout: 5) { tap(app, "Sign in or create an account") }
    tap(app, "Continue with email")
    let info = try handshake("EMAIL")               // host replies {"email": "<new synthetic OWN address>"}
    let email = app.textFields["Email address"]; XCTAssertTrue(email.waitForExistence(timeout: 10)); typeSlow(email, info["email"]!)
    tap(app, "Send code")
    let code = app.textFields["6-digit code"]; XCTAssertTrue(code.waitForExistence(timeout: 12), summary(app))
    let otp = try handshake("LOGIN_OTP")            // host replies {"code": "..."} from the OWN one-reader channel
    typeSlow(code, otp["code"]!); tap(app, "Verify & continue")

    // New account: auth gate routes to /profile-setup, or Profile shows "Finish your profile".
    let setup = app.staticTexts["A face. A little story. You."].firstMatch
    if !setup.waitForExistence(timeout: 12) {
      tap(app, "Profile, tab, 5 of 5"); tap(app, "Finish your profile")
      XCTAssertTrue(setup.waitForExistence(timeout: 10), "profile setup not reached :: " + summary(app))
    }
    shot(app, "f64-01a-profile-setup-empty")
    let first = app.textFields["First name"]; XCTAssertTrue(first.waitForExistence(timeout: 8)); typeSlow(first, "Fsixtyfour")
    let bioView = app.textViews["A little about you"], bioField = app.textFields["A little about you"]
    let bio = bioView.exists ? bioView : bioField
    XCTAssertTrue(bio.waitForExistence(timeout: 5), "bio field missing :: " + summary(app))
    typeSlow(bio, "Synthetic QA account for a deletion drill.")
    if app.keyboards.firstMatch.exists { app.staticTexts["A face. A little story. You."].firstMatch.tap() }
    tap(app, "New to London"); tap(app, "English"); tap(app, "Food")
    let consent = element(app, "I’m 18 or older and I’ll keep this community welcoming, respectful and friendship-first.")
    if consent.firstMatch.waitForExistence(timeout: 3) { tap(app, "I’m 18 or older and I’ll keep this community welcoming, respectful and friendship-first.") }
    shot(app, "f64-01b-profile-setup-filled")
    tap(app, "Take your seat")
    XCTAssertFalse(app.staticTexts["A few details are still missing."].firstMatch.waitForExistence(timeout: 4), "profile still incomplete :: " + summary(app))
    tap(app, "Profile, tab, 5 of 5")
    XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout: 10), "own profile not shown :: " + summary(app))
    XCTAssertFalse(app.buttons["Finish your profile"].exists, "profile gate still open")
    shot(app, "f64-01c-own-profile-complete")
    tap(app, "Settings")
    XCTAssertTrue(element(app, "Delete account").firstMatch.waitForExistence(timeout: 10), "Settings not reached :: " + summary(app))
    shot(app, "f64-01d-settings")
  }

  // ---- step 2: request deletion; adapter accepts upstream 202 and drops the response before headers ----
  // F64 source: "Delete my account" sends DELETE at once when auth is recent; only REAUTH_REQUIRED leads to the email code stage.
  // So the host arms BEFORE the first tap with a fault that fires only on an upstream 202 (a 403 REAUTH_REQUIRED must pass through).
  func test2_DeleteWithLost202() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: bundle); app.terminate(); app.launch(); declineAnalytics(app)
    tap(app, "Profile, tab, 5 of 5"); tap(app, "Settings"); tap(app, "Delete account")
    XCTAssertTrue(app.staticTexts["Delete your account?"].firstMatch.waitForExistence(timeout: 10), summary(app))
    shot(app, "f64-02-delete-intro")
    _ = try handshake("ARM_FAULT")                  // host arms: next POST /v1/me/deletion with upstream 202 → drop before downstream headers
    tap(app, "Delete my account")
    XCTAssertFalse(app.textFields["6-digit code"].exists,"Fresh-login branch unexpectedly requires reauth; host must terminal-stop, no rearm")
    let err = assertVisibleText(app, "We couldn’t confirm the request. Check your connection and try again.", 30)
    XCTAssertFalse(app.staticTexts["Your account is being deleted"].firstMatch.exists, "must not claim success after a lost response")
    XCTAssertFalse(app.buttons["Save or share reference"].exists, "success sheet must not appear")
    shot(app, "f64-03-lost-response-error")          // intro screen with error copy; receipt is not rendered here
    elementShot(err, "f64-03-error-copy")
    _ = try handshake("FAULT_OBSERVED")             // host: upstream 202 seen once, downstream headers 0, no second DELETE
  }

  // ---- step 3: cold relaunch (session revoked → signed out); receipt-only status ----
  func test3_RelaunchAndCheckReceipt() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: bundle); app.terminate(); app.launch(); declineAnalytics(app)
    tap(app, "Profile, tab, 5 of 5")
    XCTAssertTrue(app.buttons["Sign in or create an account"].waitForExistence(timeout: 15),
                  "expected signed-out state after server-side deletion revoked the session :: " + summary(app))
    shot(app, "f64-04-signed-out-after-relaunch")
    print("F64_STEP3_SIGNEDOUT_LABELS " + summary(app))
    // Candidate gap: static review finds no signed-out entry. The failure here is the expected evidence, kept as is.
    tap(app, "Check deletion status")
    XCTAssertTrue(app.staticTexts["Check deletion status"].firstMatch.waitForExistence(timeout: 10), summary(app))
    let field = app.textFields["Deletion reference"]; XCTAssertTrue(field.waitForExistence(timeout: 10))
    let restoredPredicate=NSPredicate { _,_ in ((field.value as? String) ?? "").count == 43 }
    _ = expectation(for:restoredPredicate,evaluatedWith:field)
    waitForExpectations(timeout:10)
    let restored = ((field.value as? String) ?? "").count
    XCTAssertEqual(restored,43,"Saved device-only reference not restored")  // length only; value never printed
    XCTAssertTrue(app.buttons["Forget saved reference"].exists, summary(app))
    privateShot(app, "f64-05-reference-restored")   // shows the receipt: private only
    tap(app, "Check status")
    let ok = ["Status: Requested"]
    let found = ok.first { app.staticTexts[$0].firstMatch.waitForExistence(timeout: 2) }
    XCTAssertNotNil(found, "no receipt status shown :: " + summary(app))
    if let f = found { elementShot(assertVisibleText(app, f), "f64-06-status-label") }
    privateShot(app, "f64-06-receipt-status")
    _ = try handshake("STATUS_OBSERVED")            // host: one deletion request, no replay/new request, status counters only
    print("F64_PASS_RECEIPT_STATUS=" + (found ?? "none"))
  }
}
