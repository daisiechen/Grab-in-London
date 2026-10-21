# R111 P0 guest-login isolation

Baseline aee2cdb plus independent QA-only probe; real temporary PG/core HTTP with controlled model and synthetic identity. Two PASS, Web-cookie and native bearer/PKCE handoff. No real identity provider, native App, Keychain or device/UI claim.

Pre-existing account identities and confirmed preferences are explicit fixture seed through PreferenceService, no OTP cooldown bypass or time changes. Guest completes a turn with private marker and confirmed soft-preference fields. Login clears/revokes guest credential and old AI device read410; account new AI session turns empty, old account preferences remain exact same fields/version1. Native guest remains valid before actual handoff exchange, exchange atomically revokes it. Logout then new guest gives different token and server subject and empty turns. No guest preference row persists.

AI033 original four expected boundaries PASS using planned api_db_or_unit method. JOURNEY001/002 actual native role swap remain NOT_RUN; API transport proof cannot close App execution gate. R110 initial Web pass retained, R111 adds native protocol.
