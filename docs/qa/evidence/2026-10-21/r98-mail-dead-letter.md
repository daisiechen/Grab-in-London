# R98 independent mail fault injection

Baseline cc489ef plus QA-only probe. Real disposable PG and controlled adapter, synthetic recipients, no real mail. Two pass / one fail. UNKNOWN lookup timeout never blindly sends, authoritative NOT_SENT enables retry using same ID, invalid private body never dispatched. Retry8 exhaustion becomes DEAD but emits no warning/error alert and no mail observer is wired: QA-F19 open, owner venues_backend confirmed. Original red must remain after repair.
