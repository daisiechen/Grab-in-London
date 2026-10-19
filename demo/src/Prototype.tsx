import {
  pilotSeed,
  act,
  advanceLifecycle,
  confirmedIds,
  eligibleAtMeal,
  attendanceStatus,
  canDirect,
  readableMessages,
  groupAccess,
  projectMember,
  projectAnalytics,
  exportAccount,
  cutoffAt,
  londonInstants,
  minimumFor,
  HOUR,
  DAY,
  type Command,
  type PilotMeal,
} from "../../shared/pilot";
import {
  reportAttendance,
  attendanceResult,
  saveExperience,
  experienceReasons,
  type AttendanceReport,
  type MealExperience,
  type ExperienceReason,
  type MealContext,
} from "./postMeal";
import { isReviewMode } from "./presentation";
import { BRAND } from "./brand";
import {
  assistantReply,
  blankPreferences,
  parseMealRequest,
  preferenceSummary,
  HELPER_IDLE_MS,
  helperClock,
  helperExpired,
  helperDockPosition,
  type HelperDock,
  type AssistantQuery,
  type AssistantReply,
  type MealPreferences,
} from "./assistant";
import {
  useEffect,
  useRef,
  useState,
  useId,
  createContext,
  useContext,
  type ReactNode,
} from "react";
const REVIEW_MODE = isReviewMode(window.location.search);
function ReviewOnly({ children }: { children: ReactNode }) {
  return REVIEW_MODE ? <>{children}</> : null;
}

import {
  GearIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  ChatBubbleIcon,
  CheckIcon,
  ChevronDownIcon,
  Cross2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  SewingPinIcon,
  ExternalLinkIcon,
  GlobeIcon,
  HeartIcon,
  InfoCircledIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  PersonIcon,
  PlusIcon,
  ReaderIcon,
  MixerHorizontalIcon,
  PaperPlaneIcon,
  CheckCircledIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import {
  BottomSheet,
  Carousel,
  KeyboardInput,
  KeyboardTextarea,
  MobileScroll,
  useKeyboard,
  useKeyboardInsets,
  useMobileDevice,
  useScreenPortal,
} from "./mobile";
import {
  initialMeals,
  members,
  eligibleMeals,
  applyToMeal,
  approveApplication,
  settleSeatPayment,
  addConfirmedMember,
  bookingStatusLabel,
  blockedMemberIds,
  mealInCategory,
  reservationNeedsUpdate,
  alternativeReservationSlot,
  longDate,
  groupChatAccess,
  inboxStage,
  conversationPreview,
  validateMeal,
  validateDemoEmail,
  validateDemoCode,
  needsAccount,
  createVenues,
  availableCreateSlots,
  validateArrangement,
  createDueNow,
  refundAmount,
  groupReady,
  groupMealsByArea,
  emptyFilters,
  monthDates,
  googleMapsAreaUrl,
  type DiscoveryFilters,
  type Meal,
  type JoinState,
  type PaymentState,
  type BookingState,
} from "./domain";

const initialDraft = {
  title: "",
  venue: "The Little Table",
  date: "2026-10-23",
  time: "19:00",
  capacity: 4,
  min: 25,
  max: 35,
  description: "",
  language: "English",
  mood: "Easy conversation",
  cost: "deposit",
  booking: "in-app",
  deposit: 10,
  externalConfirmed: false,
  accepted: false,
};

type Page =
  | "discover"
  | "detail"
  | "member"
  | "apply"
  | "status"
  | "checkout"
  | "booking"
  | "chat"
  | "create"
  | "meals"
  | "inbox"
  | "profile"
  | "edit"
  | "review"
  | "host"
  | "direct"
  | "settings";
type Sheet =
  | ""
  | "date"
  | "size"
  | "area"
  | "filters"
  | "cancel"
  | "scenarios"
  | "report"
  | "reset"
  | "signout";
const labels: Record<JoinState, string> = {
  NONE: "Open table",
  PENDING: "Application pending",
  DECLINED: "Application declined",
  WITHDRAWN: "Application withdrawn",
  APPROVED_PAYMENT_PENDING: "Approved · payment pending",
  CONFIRMED: "Your seat is confirmed",
  CANCELLED: "Participation cancelled",
};
const iconStyle = { width: 18, height: 18 };
const money = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
const SelfProfileContext = createContext({ image: "leo", name: "Alex" });
function Avatar({
  id,
  onClick,
  size = 34,
}: {
  id: string;
  onClick?: () => void;
  size?: number;
}) {
  const self = useContext(SelfProfileContext);
  const m =
    id === "alex" ? { ...members.alex, ...self } : members[id] || members.maya;
  const content = (
    <img
      src={`/images/${m.image}.png`}
      alt={m.name}
      width={size}
      height={size}
    />
  );
  return onClick ? (
    <button
      className="avatar"
      style={{ width: size, height: size }}
      onClick={onClick}
      aria-label={`View ${m.name}'s profile`}
    >
      {content}
    </button>
  ) : (
    <span className="avatar" style={{ width: size, height: size }}>
      {content}
    </span>
  );
}
function Primary({
  children,
  onClick,
  disabled = false,
  secondary = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <button
      type="button"
      className={`primary ${secondary ? "secondary" : ""}`}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function ChoiceGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  const groupId = useId();
  return (
    <fieldset className="filter-section">
      <legend>{label}</legend>
      <div className="choice-grid">
        {options.map(([key, text]) => (
          <label
            className={`choice-chip ${value === key ? "chosen" : ""}`}
            key={key}
          >
            <input
              type="radio"
              name={groupId}
              value={key}
              checked={value === key}
              onChange={() => onChange(key)}
            />
            <span>{text}</span>
            {value === key && <CheckIcon />}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function DateChoices({
  value,
  onChange,
  meals,
  creation = false,
}: {
  value: string;
  onChange: (date: string) => void;
  meals: Meal[];
  creation?: boolean;
}) {
  const [month, setMonth] = useState(value ? value.slice(0, 7) : "2026-10");
  const id = useId();
  const { offset, dates } = monthDates(month);
  const changeMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    setMonth(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7));
  };
  return (
    <div className="date-choices">
      <ChoiceGroup
        label="Date preference"
        value={value ? "specific" : ""}
        onChange={(key) => {
          if (key === "") onChange("");
        }}
        options={
          value
            ? [
                ["", "Any date"],
                ["specific", longDate(value)],
              ]
            : [["", "Any date"]]
        }
      />
      <div className="calendar-heading">
        <strong>
          {new Intl.DateTimeFormat("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(month + "-01T12:00:00Z"))}
        </strong>
        <div>
          <button
            aria-label="Previous month"
            disabled={month <= "2026-10"}
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeftIcon />
          </button>
          <button
            aria-label="Next month"
            disabled={creation && month >= "2026-11"}
            onClick={() => changeMonth(1)}
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <fieldset className="calendar-days">
        <legend className="sr-only">Choose a date</legend>
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {dates.map((date) => (
          <label
            key={date}
            className={`calendar-day ${date === value ? "chosen" : ""} ${date < "2026-10-16" ? "unavailable" : ""}`}
          >
            <input
              type="radio"
              name={id}
              aria-label={new Intl.DateTimeFormat("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(date + "T12:00:00Z"))}
              disabled={
                creation
                  ? date < "2026-10-17" || date > "2026-11-15"
                  : date < "2026-10-16"
              }
              checked={value === date}
              onChange={() => onChange(date)}
            />
            <span>{Number(date.slice(-2))}</span>
            {meals.some((m) => m.date === date) && <i aria-hidden="true" />}
          </label>
        ))}
      </fieldset>
      <p className="calendar-hint">
        {creation ? (
          "Choose a date · London time"
        ) : (
          <>
            <span /> Meals available · London time
          </>
        )}
      </p>
    </div>
  );
}

type WelcomeProfile = {
  photo?: string;
  name: string;
  bio: string;
  life: string;
  language: string;
  interests: string;
  work: string;
  school: string;
  hometown: string;
};
function BrandEntrance({
  start,
  onBrowse,
  onComplete,
}: {
  start: "splash" | "account";
  onBrowse: () => void;
  onComplete: (profile?: WelcomeProfile) => void;
}) {
  const keyboard = useKeyboard();
  const [stage, setStage] = useState<
    "splash" | "welcome" | "account" | "email" | "verify" | "setup"
  >(start);
  const [intent, setIntent] = useState("new");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [issue, setIssue] = useState("");
  const [provider, setProvider] = useState("");
  const authIssueRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    keyboard.hide();
  }, [stage, provider]);
  useEffect(() => {
    if (issue) {
      keyboard.hide();
      authIssueRef.current?.scrollIntoView({ block: "center" });
    }
  }, [issue]);
  const [agreed, setAgreed] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expired, setExpired] = useState(false);
  const [codeVersion, setCodeVersion] = useState(0);
  const [showTerms, setShowTerms] = useState(false);
  const [photo, setPhoto] = useState("leo");
  const [person, setPerson] = useState<WelcomeProfile>({
    name: "",
    bio: "",
    life: "New to London",
    language: "English",
    interests: "Food",
    work: "",
    school: "",
    hometown: "",
  });
  const move = (next: typeof stage) => {
    keyboard.hide();
    setIssue("");
    setStage(next);
  };
  useEffect(() => {
    if (stage !== "splash") return;
    const timer = setTimeout(() => setStage("welcome"), 2200);
    return () => clearTimeout(timer);
  }, [stage]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (stage !== "verify") return;
    const timer = setTimeout(() => setExpired(true), 300000);
    return () => clearTimeout(timer);
  }, [stage, email, codeVersion]);
  const finishIdentity = () => {
    if (intent === "returning") onComplete();
    else move("setup");
  };
  const wordmark = (
    <div className="brand-wordmark" aria-label={BRAND.name}>
      {BRAND.wordmark}
      <i aria-hidden="true">
        <ArrowRightIcon />
      </i>
    </div>
  );
  if (stage === "splash")
    return (
      <div className="grab-app brand-splash">
        <div className="brand-splash-center">
          {wordmark}
          <p>{BRAND.invitation}</p>
        </div>
        <button onClick={() => move("welcome")}>
          Skip intro <ArrowRightIcon />
        </button>
        <small>{BRAND.slogan}</small>
      </div>
    );
  return (
    <div className="grab-app brand-entrance" data-review={REVIEW_MODE}>
      <ReviewOnly>
        <div className="brand-demo-label">
          DESIGN PROTOTYPE · DEMO ACCOUNTS ONLY
        </div>
      </ReviewOnly>
      <MobileScroll key={stage} className="brand-scroll">
        <div
          className={`brand-content ${stage === "welcome" ? "brand-welcome" : ""}`}
        >
          {stage === "welcome" ? (
            <>
              <header>
                {wordmark}
                <ReviewOnly>
                  <span className="brand-city">LONDON, LET’S EAT.</span>
                </ReviewOnly>
              </header>
              <div className="brand-art">
                <img
                  src="/images/brand-table.png"
                  alt="A sculptural green table with colourful chairs, laid for new friends"
                />
              </div>
              <div className="brand-welcome-copy">
                <div className="eyebrow">{BRAND.welcomeSupport}</div>
                <h1>{BRAND.invitation}</h1>
                <p>{BRAND.slogan}</p>
              </div>
              <Primary onClick={() => move("account")}>
                Find your people <ArrowRightIcon />
              </Primary>
              <button
                className="brand-browse"
                onClick={() => {
                  keyboard.hide();
                  onBrowse();
                }}
              >
                Explore tables first
              </button>
              <ReviewOnly>
                <button
                  className="brand-browse brand-replay"
                  onClick={() => move("splash")}
                >
                  Replay intro
                </button>
              </ReviewOnly>
            </>
          ) : (
            <>
              <header className="brand-form-header">
                <button
                  aria-label="Back in sign-in"
                  onClick={() =>
                    move(
                      stage === "setup"
                        ? "account"
                        : stage === "verify"
                          ? "email"
                          : stage === "email"
                            ? "account"
                            : "welcome",
                    )
                  }
                >
                  <ArrowLeftIcon />
                </button>
                {wordmark}
              </header>
              <div className="eyebrow">
                {stage === "setup"
                  ? "ONE LAST INTRODUCTION"
                  : "YOUR NEXT TABLE STARTS HERE"}
              </div>
              <h1>
                {stage === "account"
                  ? "Good to meet you."
                  : stage === "email"
                    ? "Let’s keep in touch."
                    : stage === "verify"
                      ? "Check your inbox."
                      : "A face. A little story. You."}
              </h1>
              <p className="prose">
                {stage === "account"
                  ? "Join a table, or come back for another."
                  : stage === "email"
                    ? "We’ll use a one-time code, so there’s no password to remember."
                    : stage === "verify"
                      ? `Enter the six-digit code for ${email}.`
                      : "Give your future table a little context. Your email stays private."}
              </p>
              {issue && (
                <p ref={authIssueRef} className="form-error" role="alert">
                  {issue}
                </p>
              )}
              {stage === "account" && (
                <>
                  <ChoiceGroup
                    label="I’m here to"
                    value={intent}
                    onChange={setIntent}
                    options={[
                      ["new", "Create an account"],
                      ["returning", "Log in"],
                    ]}
                  />
                  <Primary onClick={() => move("email")}>
                    Continue with email <ArrowRightIcon />
                  </Primary>
                  <div className="brand-divider">or</div>
                  <button
                    className="brand-provider"
                    onClick={() => {
                      setProvider("Google");
                      setIssue("");
                    }}
                  >
                    Continue with Google <ExternalLinkIcon />
                  </button>
                  <button
                    className="brand-provider"
                    onClick={() => {
                      setProvider("Apple");
                      setIssue("");
                    }}
                  >
                    Continue with Apple <ExternalLinkIcon />
                  </button>
                  <button
                    className="brand-provider"
                    onClick={() => {
                      setProvider("Facebook");
                      setIssue("");
                    }}
                  >
                    Continue with Facebook <ExternalLinkIcon />
                  </button>
                  <ReviewOnly>
                    <p className="demo-note">
                      Simulated sign-in only. No provider opens and no personal
                      data is sent.
                    </p>
                  </ReviewOnly>
                  <button
                    className="text-action"
                    onClick={() => setShowTerms(true)}
                  >
                    Privacy & community principles
                  </button>
                  <button className="brand-browse" onClick={onBrowse}>
                    Keep exploring without an account
                  </button>
                </>
              )}
              {stage === "email" && (
                <>
                  <Field label="Email address">
                    <KeyboardInput
                      type="email"
                      autoComplete="off"
                      value={email}
                      onBlur={() => keyboard.hide()}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@example.com"
                    />
                  </Field>
                  <ReviewOnly>
                    <p className="demo-note">
                      Use a sample address. No email will be sent.
                    </p>
                  </ReviewOnly>
                  <Primary
                    onClick={() => {
                      const error = validateDemoEmail(email);
                      if (error) {
                        keyboard.hide();
                        setIssue(error);
                        return;
                      }
                      setEmail(email.trim());
                      setCode("");
                      setExpired(false);
                      setCooldown(30);
                      setCodeVersion((v) => v + 1);
                      move("verify");
                    }}
                  >
                    Send code <ArrowRightIcon />
                  </Primary>
                </>
              )}
              {stage === "verify" && (
                <>
                  <Field label="6-digit code">
                    <KeyboardInput
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onBlur={() => keyboard.hide()}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="123456"
                    />
                  </Field>
                  <Primary
                    onClick={() => {
                      const error = validateDemoCode(code, expired);
                      if (error) {
                        keyboard.hide();
                        setIssue(error);
                        return;
                      }
                      keyboard.hide();
                      finishIdentity();
                    }}
                  >
                    {intent === "returning" ? "Log in" : "Verify & continue"}
                    <ArrowRightIcon />
                  </Primary>
                  <button
                    className="text-action"
                    disabled={cooldown > 0}
                    onClick={() => {
                      setExpired(false);
                      setCode("");
                      setCooldown(30);
                      setCodeVersion((v) => v + 1);
                      setIssue("A new code is ready.");
                    }}
                  >
                    {cooldown ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                  <button className="text-action" onClick={() => move("email")}>
                    Change email
                  </button>
                  <ReviewOnly>
                    <button
                      className="text-action"
                      onClick={() => {
                        setExpired(true);
                        setIssue(
                          "The code has expired. Request a new code when resend is ready.",
                        );
                      }}
                    >
                      Preview expired code
                    </button>
                  </ReviewOnly>
                </>
              )}
              {stage === "setup" && (
                <>
                  <Field label="Choose a photo">
                    <div className="brand-photo-options">
                      {["leo", "maya", "emma"].map((id) => (
                        <button
                          key={id}
                          aria-label={`Choose ${id} portrait`}
                          aria-pressed={photo === id}
                          onClick={() => setPhoto(id)}
                        >
                          <img
                            src={`/images/${id}.png`}
                            alt="Profile portrait"
                          />
                          {photo === id && <CheckCircledIcon />}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="First name">
                    <KeyboardInput
                      value={person.name}
                      maxLength={40}
                      placeholder="Alex"
                      onBlur={() => keyboard.hide()}
                      onChange={(e) =>
                        setPerson({ ...person, name: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="A little about you">
                    <KeyboardTextarea
                      value={person.bio}
                      maxLength={1000}
                      rows={3}
                      placeholder="What brought you to London? What do you enjoy?"
                      onBlur={() => keyboard.hide()}
                      onChange={(e) =>
                        setPerson({ ...person, bio: e.target.value })
                      }
                    />
                  </Field>
                  <small>
                    At least 20 characters. Share what you’re comfortable making
                    public.
                  </small>
                  <ChoiceGroup
                    label="Life in London"
                    value={person.life}
                    onChange={(life) => setPerson({ ...person, life })}
                    options={[
                      "New to London",
                      "Making London home",
                      "Visiting London",
                    ].map((v) => [v, v])}
                  />
                  <ChoiceGroup
                    label="Conversation language"
                    value={person.language}
                    onChange={(language) => setPerson({ ...person, language })}
                    options={[
                      "English",
                      "English & Mandarin",
                      "English & French",
                    ].map((v) => [v, v])}
                  />
                  <ChoiceGroup
                    label="An interest to start with"
                    value={person.interests}
                    onChange={(interests) =>
                      setPerson({ ...person, interests })
                    }
                    options={["Food", "Design", "Travel", "Books", "Music"].map(
                      (v) => [v, v],
                    )}
                  />
                  <p className="muted">
                    Add work, school, hometown and more interests in Edit
                    profile whenever you like.
                  </p>
                  <label className="create-consent">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <span>
                      I’m 18 or older and I’ll keep this community welcoming,
                      respectful and friendship-first.
                    </span>
                  </label>
                  <button
                    className="text-action"
                    onClick={() => setShowTerms(true)}
                  >
                    Read privacy & community principles
                  </button>
                  <Primary
                    onClick={() => {
                      keyboard.hide();
                      if (
                        person.name.trim().length < 2 ||
                        person.bio.trim().length < 20
                      ) {
                        setIssue(
                          "Add a name of at least 2 characters and an introduction of at least 20 characters.",
                        );
                        return;
                      }
                      if (!agreed) {
                        setIssue(
                          "Confirm the age and community acknowledgement to continue.",
                        );
                        return;
                      }
                      onComplete({
                        ...person,
                        photo,
                        name: person.name.trim(),
                      });
                    }}
                  >
                    Take your seat <ArrowRightIcon />
                  </Primary>
                </>
              )}
            </>
          )}
        </div>
      </MobileScroll>
      <BottomSheet
        open={!!provider}
        onOpenChange={(open) => {
          if (!open) setProvider("");
        }}
        title={`${provider} sign-in`}
      >
        <div className="body-pad">
          <p>Review this sign-in preview as Alex, or cancel to return.</p>
          <ReviewOnly>
            <p>No provider is contacted. Your original action is preserved.</p>
          </ReviewOnly>
          <Primary
            onClick={() => {
              setProvider("");
              finishIdentity();
            }}
          >
            Continue as Alex
          </Primary>
          <ReviewOnly>
            <button
              className="text-action"
              onClick={() => {
                setProvider("");
                setIssue("Sign-in could not be completed. Retry or use email.");
              }}
            >
              Preview provider failure
            </button>
            <button
              className="text-action"
              onClick={() => {
                setProvider("");
                setIssue(
                  "This provider identity is linked to a different account. Sign in to that account to link it; no automatic merge.",
                );
              }}
            >
              Preview account link conflict
            </button>
          </ReviewOnly>
          <button className="text-action" onClick={() => setProvider("")}>
            Cancel
          </button>
        </div>
      </BottomSheet>
      <BottomSheet
        open={showTerms}
        onOpenChange={setShowTerms}
        title="Community & privacy principles"
      >
        <div className="body-pad">
          <p>
            Adults 18+ meet for friendship over meals. Respect boundaries and
            dietary needs. No harassment or unsolicited pitches.
          </p>
          <p>
            Your name, photo and introduction are public to other members; your
            email is private.
          </p>
          <ReviewOnly>
            {" "}
            <p>
              These are design examples, not production Terms of Service or a
              privacy policy. Final legal documents, account deletion and
              reporting support are required before launch.
            </p>
          </ReviewOnly>
          <Primary onClick={() => setShowTerms(false)}>Back to sign-up</Primary>
        </div>
      </BottomSheet>
    </div>
  );
}

type HelperAction = NonNullable<AssistantReply["draft"]>;
type HelperTurn = {
  question: string;
  reply: AssistantReply;
  time: number;
  used?: boolean;
};
type SpeechSession = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  abort: () => void;
  onresult:
    | ((event: {
        results: {
          [index: number]: { [index: number]: { transcript: string } };
        };
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
function HelperSprite() {
  return (
    <svg className="helper-sprite" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M32 12C25 2 16 6 18 15c-13 4-16 18-11 29 4 10 11 13 25 11 14 2 21-1 25-11 5-11 2-25-11-29 2-9-7-13-14-3Z"
        fill="currentColor"
      />
      <path d="M30 13c0-8 7-11 13-9-1 6-6 10-13 9Z" fill="#d7ee79" />
      <ellipse cx="23" cy="33" rx="3" ry="4" fill="#f5f2e8" />
      <ellipse cx="41" cy="33" rx="3" ry="4" fill="#f5f2e8" />
      <path
        d="M26 43q6 5 12 0"
        fill="none"
        stroke="#f5f2e8"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="40" r="3" fill="#ffb49b" />
      <circle cx="48" cy="40" r="3" fill="#ffb49b" />
    </svg>
  );
}
type MapSpot = {
  id: string;
  label: string;
  x: number;
  y: number;
  text: string;
};
function DemoMap({
  spots,
  selected,
  onSelect,
  onSearch,
  label,
}: {
  spots: MapSpot[];
  selected: string;
  onSelect: (id: string) => void;
  onSearch?: (ids: string[]) => void;
  label: string;
}) {
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [dirty, setDirty] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{
    x: number;
    y: number;
    distance: number;
    view: typeof view;
    moved: boolean;
  } | null>(null);
  const suppress = useRef(false);
  const clamp = (v: typeof view) => {
    const zoom = Math.max(1, Math.min(2.4, v.zoom));
    const limit = (74 * zoom - 50) / 1.48;
    return {
      zoom,
      x: Math.max(-limit, Math.min(limit, v.x)),
      y: Math.max(-limit, Math.min(limit, v.y)),
    };
  };
  const zoom = (delta: number) => {
    setView((v) => clamp({ ...v, zoom: v.zoom + delta }));
    setDirty(true);
  };
  return (
    <div
      className="demo-map"
      ref={root}
      role="region"
      aria-label={label}
      tabIndex={0}
      data-scroll-drag="ignore"
      data-zoom={view.zoom.toFixed(1)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "+" || event.key === "-") {
          event.preventDefault();
          zoom(event.key === "+" ? 0.3 : -0.3);
        }
        if (event.key.startsWith("Arrow")) {
          event.preventDefault();
          setDirty(true);
          setView((v) =>
            clamp({
              ...v,
              x:
                v.x +
                (event.key === "ArrowLeft"
                  ? 5
                  : event.key === "ArrowRight"
                    ? -5
                    : 0),
              y:
                v.y +
                (event.key === "ArrowUp"
                  ? 5
                  : event.key === "ArrowDown"
                    ? -5
                    : 0),
            }),
          );
        }
      }}
      onPointerDown={(event) => {
        suppress.current = false;
        if (event.button !== 0 || (event.target as Element).closest("button"))
          return;
        points.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        const p = [...points.current.values()];
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          distance:
            p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0,
          view,
          moved: false,
        };
        if (!(event.target as Element).closest("button"))
          event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current || !points.current.has(event.pointerId)) return;
        points.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        const d = drag.current,
          p = [...points.current.values()];
        const dx = event.clientX - d.x,
          dy = event.clientY - d.y;
        if (Math.hypot(dx, dy) < 6 && p.length < 2) return;
        d.moved = true;
        suppress.current = true;
        setDirty(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        const rect = root.current!.getBoundingClientRect();
        if (p.length > 1 && d.distance > 0)
          setView(
            clamp({
              ...d.view,
              zoom:
                (d.view.zoom * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)) /
                d.distance,
            }),
          );
        else
          setView(
            clamp({
              ...d.view,
              x: d.view.x + ((dx / rect.width) * 100) / 1.48,
              y: d.view.y + ((dy / rect.height) * 100) / 1.48,
            }),
          );
      }}
      onPointerUp={(event) => {
        points.current.delete(event.pointerId);
        if (!points.current.size) drag.current = null;
      }}
      onPointerCancel={() => {
        points.current.clear();
        drag.current = null;
      }}
      onClickCapture={(event) => {
        if (suppress.current) {
          event.preventDefault();
          event.stopPropagation();
          suppress.current = false;
        }
      }}
    >
      <div
        className="demo-map-world"
        style={{
          transform: `translate(${view.x}%, ${view.y}%) scale(${view.zoom})`,
        }}
      >
        <img
          className="map-image"
          src="/images/london-map.png"
          alt="Map of central London"
          draggable={false}
        />
      </div>
      {spots.map((spot) => (
        <button
          key={spot.id}
          className={`map-pin ${selected === spot.id ? "active" : ""}`}
          style={{
            left: `${50 + (spot.x - 50) * view.zoom + 1.48 * view.x}%`,
            top: `${50 + (spot.y - 50) * view.zoom + 1.48 * view.y}%`,
          }}
          aria-label={spot.label}
          aria-pressed={selected === spot.id}
          onClick={() => onSelect(spot.id)}
        >
          {spot.text}
        </button>
      ))}
      {onSearch && dirty && (
        <button
          className="map-search-area"
          onClick={() => {
            const ids = spots
              .filter(
                (p) =>
                  Math.abs((p.x - 50) * view.zoom + 1.48 * view.x) < 48 &&
                  Math.abs((p.y - 50) * view.zoom + 1.48 * view.y) < 48,
              )
              .map((p) => p.id);
            onSearch(ids);
            setDirty(false);
          }}
        >
          Search this area
        </button>
      )}
      <div className="demo-map-controls">
        <button
          aria-label="Zoom in"
          disabled={view.zoom >= 2.4}
          onClick={() => zoom(0.3)}
        >
          +
        </button>
        <button
          aria-label="Zoom out"
          disabled={view.zoom <= 1}
          onClick={() => zoom(-0.3)}
        >
          −
        </button>
        <button
          aria-label="Show central London"
          onClick={() => {
            setView({ x: 0, y: 0, zoom: 1 });
            setDirty(false);
            onSearch?.(spots.map((p) => p.id));
          }}
        >
          ⌖
        </button>
      </div>
    </div>
  );
}

function VenueMap({
  value,
  onConfirm,
}: {
  value: string;
  onConfirm: (venue: (typeof createVenues)[number]) => void;
}) {
  const keyboard = useKeyboard();
  const [search, setSearch] = useState("");
  const [candidate, setCandidate] = useState(value);
  const visible = createVenues.filter((v) =>
    `${v.name} ${v.area} ${v.cuisine}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const venue = visible.find((v) => v.name === candidate);
  const coords = [
    { x: 48, y: 42 },
    { x: 76, y: 38 },
    { x: 30, y: 70 },
  ];
  return (
    <section className="venue-map-picker" aria-label="Choose a restaurant">
      <label className="field-label">
        Search restaurants or areas
        <KeyboardInput
          aria-label="Search restaurants or areas"
          value={search}
          placeholder="Soho, Spanish, restaurant name…"
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <DemoMap
        label="Restaurant map"
        selected={candidate}
        spots={visible.map((v) => ({
          id: v.name,
          label: `Show ${v.name}`,
          text: String(createVenues.indexOf(v) + 1),
          ...coords[createVenues.indexOf(v)],
        }))}
        onSelect={(name) => {
          keyboard.hide();
          setCandidate(name);
        }}
      />
      <div className="venue-map-results">
        {!visible.length && (
          <p>No restaurants match. Try another name or area.</p>
        )}
        {search &&
          visible.map((v) => (
            <button
              key={v.name}
              aria-pressed={candidate === v.name}
              onClick={() => {
                keyboard.hide();
                setCandidate(v.name);
              }}
            >
              <strong>{v.name}</strong>
              <span>
                {v.area} · {v.cuisine}
              </span>
            </button>
          ))}
      </div>
      {venue && (
        <div className="venue-map-card">
          <strong>{venue.name}</strong>
          <p>
            {venue.area} · {venue.cuisine}
          </p>
          <p>{venue.note}</p>
          <p>
            £{venue.min}–{venue.max} per person
          </p>
          <button
            className="primary"
            onClick={() => {
              keyboard.hide();
              onConfirm(venue);
            }}
          >
            Use this restaurant
          </button>
        </div>
      )}
      <p className="venue-selection-status" role="status">
        {value ? `Selected: ${value}.` : "Choose a restaurant to preview it."}{" "}
        Choosing a place does not reserve a table.
      </p>
    </section>
  );
}

function MealHelper({
  meals,
  current,
  filters,
  page,
  visible,
  onAction,
  onMeal,
  voiceEnabled = true,
}: {
  meals: Meal[];
  current?: Meal;
  voiceEnabled?: boolean;
  filters: DiscoveryFilters;
  page: string;
  visible: boolean;
  onAction: (action: HelperAction, query: AssistantQuery) => void;
  onMeal: (id: string) => void;
}) {
  const keyboard = useKeyboard();
  const helperInsets = useKeyboardInsets();
  const { device } = useMobileDevice();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [home, setHome] = useState(true);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastActive, setLastActive] = useState<number | null>(null);
  const [dock, setDock] = useState<HelperDock>({ side: "right", fraction: 0 });
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const launcherRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    pointer: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    scale: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<HelperTurn[]>([]);
  const [query, setQuery] = useState<AssistantQuery>({});
  const [preferences, setPreferences] = useState<MealPreferences>({
    ...blankPreferences,
  });
  const [manage, setManage] = useState(false);
  const [preferenceEdit, setPreferenceEdit] = useState("");
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const recognition = useRef<SpeechSession | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const speechConstructor = () => {
    const browser = window as unknown as {
      SpeechRecognition?: new () => SpeechSession;
      webkitSpeechRecognition?: new () => SpeechSession;
    };
    return browser.SpeechRecognition || browser.webkitSpeechRecognition;
  };
  const stopVoice = () => {
    const session = recognition.current;
    if (session) {
      session.onresult = null;
      session.onerror = null;
      session.onend = null;
      session.abort();
    }
    recognition.current = null;
    setListening(false);
  };
  const close = () => {
    keyboard.hide();
    stopVoice();
    setVoiceConsent(false);
    setOpen(false);
  };
  const restart = (expired = false) => {
    keyboard.hide();
    stopVoice();
    setVoiceConsent(false);
    setTurns([]);
    setQuery({});
    setStartedAt(null);
    setLastActive(null);
    setManage(false);
    setHome(true);
    if (!expired) setInput("");
    setNotice(
      expired
        ? "Your previous conversation ended after 30 minutes without activity. Saved preferences and unsent text are kept."
        : "New conversation. Saved preferences are kept.",
    );
  };
  const openHome = () => {
    keyboard.hide();
    stopVoice();
    setVoiceConsent(false);
    if (helperExpired(lastActive, Date.now())) restart(true);
    else
      setNotice((value) =>
        value.startsWith("Your previous conversation ended") ? value : "",
      );
    setManage(false);
    setHome(true);
    setHidden(false);
    setOpen(true);
  };
  useEffect(() => {
    if (lastActive === null || !turns.length) return;
    const timer = setTimeout(
      () => restart(true),
      Math.max(0, HELPER_IDLE_MS - (Date.now() - lastActive)),
    );
    return () => clearTimeout(timer);
  }, [lastActive, turns.length]);
  useEffect(
    () => () => {
      const session = recognition.current;
      if (session) {
        session.onresult = null;
        session.onerror = null;
        session.onend = null;
        session.abort();
      }
    },
    [],
  );
  useEffect(() => {
    if (!visible) close();
  }, [visible]);
  useEffect(() => {
    const pane = conversationRef.current;
    if (pane && open && !manage && !home) pane.scrollTop = pane.scrollHeight;
  }, [turns.length, open, manage, home]);
  const submit = (question = input) => {
    if (!question.trim()) return;
    keyboard.hide();
    stopVoice();
    const now = Date.now();
    const expired = helperExpired(lastActive, now);
    const fresh = expired || home;
    setNotice(
      expired
        ? "Your previous conversation expired. This is a new conversation; saved preferences are kept."
        : "",
    );
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const reply = assistantReply(question.trim(), {
      meals,
      current,
      filters,
      query: fresh ? {} : query,
      preferences,
      today,
    });
    if (reply.query) setQuery(reply.query);
    else if (fresh) setQuery({});
    if (fresh || !turns.length) setStartedAt(now);
    setLastActive(now);
    setHome(false);
    setManage(false);
    setTurns((t) => [
      ...(fresh ? [] : t),
      { question: question.trim(), reply, time: now },
    ]);
    setInput("");
  };
  const startVoice = () => {
    keyboard.hide();
    setVoiceConsent(false);
    setNotice("");
    const Speech = speechConstructor();
    if (!Speech) {
      setNotice(
        "Voice input isn’t available in this browser. You can still type your request.",
      );
      return;
    }
    const session = new Speech();
    recognition.current = session;
    session.lang = "en-GB";
    session.continuous = false;
    session.interimResults = false;
    session.onresult = (e) => {
      setLastActive(Date.now());
      setInput((value) =>
        [value, e.results[0][0].transcript]
          .filter(Boolean)
          .join(" ")
          .slice(0, 1000),
      );
      setNotice("Check the transcript, then send when you’re ready.");
    };
    session.onerror = (e) => {
      setListening(false);
      setNotice(
        e.error === "not-allowed"
          ? "Microphone access wasn’t granted. You can type instead or change your browser permission."
          : "Voice input stopped. Try again or type your request.",
      );
    };
    session.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    try {
      session.start();
      setListening(true);
    } catch {
      setNotice("Voice input couldn’t start. Please type or try again.");
      setListening(false);
    }
  };
  const prompts = current
    ? [
        "Explain this meal’s costs",
        "Draft an application",
        "Draft a group message",
      ]
    : [
        "Find a meal for Friday",
        "Compare meals under £35",
        "Help me create a meal",
      ];
  const helperHeight = Math.min(
    device.geometry.screen.height * 0.82,
    helperInsets.availableHeight - device.geometry.safeArea.top - 8,
  );
  // BottomSheet subtracts up to 180px for the keyboard. Supply the desired
  // available height before that adjustment so the header stays below chrome.
  const helperSnap =
    (helperHeight + Math.min(helperInsets.keyboardHeight, 180)) /
    device.geometry.screen.height;
  const dockTop =
    device.geometry.safeArea.top + (page === "discover" ? 170 : 64);
  const dockBottom = helperInsets.availableHeight - 100;
  const dockPoint = helperDockPosition(
    dock,
    device.geometry.screen.width,
    dockTop,
    dockBottom,
    hidden,
  );
  const point = dragPoint || dockPoint;
  const cancelDrag = () => {
    gesture.current = null;
    setDragPoint(null);
  };
  if (!visible) return null;
  return (
    <>
      {!open && !helperInsets.isKeyboardVisible && (
        <div
          ref={launcherRef}
          className={`helper-launcher ${hidden ? "is-tucked" : ""} ${dragPoint ? "is-dragging" : ""}`}
          data-side={dock.side}
          style={{ left: point.x, top: point.y }}
        >
          <button
            aria-label={hidden ? "Show Fancy helper" : "Open Fancy helper"}
            className="helper-launch"
            data-scroll-drag="ignore"
            title="Drag to move. Tap to open. Arrow keys also move Fancy."
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              suppressClick.current = false;
              const rect =
                launcherRef.current!.parentElement!.getBoundingClientRect();
              gesture.current = {
                pointer: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                x: point.x,
                y: point.y,
                scale: rect.width / device.geometry.screen.width,
                moved: false,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = gesture.current;
              if (!drag || drag.pointer !== event.pointerId) return;
              const dx = (event.clientX - drag.startX) / drag.scale;
              const dy = (event.clientY - drag.startY) / drag.scale;
              if (Math.hypot(dx, dy) > 6) drag.moved = true;
              if (!drag.moved) return;
              setDragPoint({
                x: Math.max(
                  14,
                  Math.min(device.geometry.screen.width - 78, drag.x + dx),
                ),
                y: Math.max(
                  dockTop,
                  Math.min(Math.max(dockTop, dockBottom - 74), drag.y + dy),
                ),
              });
            }}
            onPointerUp={(event) => {
              const drag = gesture.current;
              if (!drag || drag.pointer !== event.pointerId) return;
              if (drag.moved) {
                const y = Math.max(
                  dockTop,
                  Math.min(
                    Math.max(dockTop, dockBottom - 74),
                    drag.y + (event.clientY - drag.startY) / drag.scale,
                  ),
                );
                const x = drag.x + (event.clientX - drag.startX) / drag.scale;
                setDock({
                  side:
                    x + 32 < device.geometry.screen.width / 2
                      ? "left"
                      : "right",
                  fraction:
                    (y - dockTop) / Math.max(1, dockBottom - 74 - dockTop),
                });
                suppressClick.current = true;
              }
              gesture.current = null;
              setDragPoint(null);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
            onKeyDown={(event) => {
              if (!event.key.startsWith("Arrow")) return;
              event.preventDefault();
              setDock((position) => ({
                side:
                  event.key === "ArrowLeft"
                    ? "left"
                    : event.key === "ArrowRight"
                      ? "right"
                      : position.side,
                fraction: Math.max(
                  0,
                  Math.min(
                    1,
                    position.fraction +
                      (event.key === "ArrowDown"
                        ? 0.1
                        : event.key === "ArrowUp"
                          ? -0.1
                          : 0),
                  ),
                ),
              }));
            }}
            onClick={(event) => {
              if (suppressClick.current && event.detail !== 0) {
                suppressClick.current = false;
                return;
              }
              openHome();
            }}
          >
            <HelperSprite />
            {hidden && (
              <span className="helper-paws" aria-hidden="true">
                <i />
                <i />
              </span>
            )}
            {!hidden && <span>Ask Fancy</span>}
          </button>
          {!hidden && (
            <button
              className="helper-hide"
              aria-label="Tuck Fancy to edge"
              title="Tuck to screen edge"
              onClick={() => setHidden(true)}
            >
              {dock.side === "right" ? "›" : "‹"}
            </button>
          )}
        </div>
      )}
      <BottomSheet
        open={open}
        onOpenChange={(value) => (value ? openHome() : close())}
        title="A little help from Fancy"
        description="Find a table. Make a plan. You decide."
        snap={helperSnap}
      >
        <div
          className="helper-panel"
          data-testid="meal-helper"
          onClickCapture={(event) => {
            if (helperExpired(lastActive, Date.now())) {
              restart(true);
              event.preventDefault();
              event.stopPropagation();
            } else if (turns.length) setLastActive(Date.now());
          }}
          onPointerDownCapture={(event) => {
            // Match Primary: don't blur an editor and move its action under the
            // pointer before that action receives the click.
            if (
              event.target instanceof Element &&
              event.target.closest("button")
            )
              event.preventDefault();
          }}
        >
          <div className="helper-tools">
            <HelperSprite />
            <span className="helper-context">
              {current
                ? current.title
                : page === "create"
                  ? "Your meal draft"
                  : "Your meal plans"}
            </span>
            <button
              onClick={() => {
                keyboard.hide();
                stopVoice();
                setVoiceConsent(false);
                if (manage) {
                  setManage(false);
                  setHome(true);
                } else setManage(true);
                setNotice("");
                setPreferenceEdit(preferenceSummary(preferences));
              }}
            >
              {manage ? "Back to assistant home" : "My preferences"}
            </button>
          </div>
          <div className="helper-utility">
            {!home && !manage && (
              <button
                onClick={() => {
                  keyboard.hide();
                  stopVoice();
                  setHome(true);
                  setNotice("");
                }}
              >
                Assistant home
              </button>
            )}
            {!manage && !!turns.length && (
              <button onClick={() => restart()}>New conversation</button>
            )}
          </div>
          {manage ? (
            <div className="helper-preferences">
              <h3>What I remember</h3>
              <p>
                Only preferences you approve. Kept for this session; you can
                change or delete them.
              </p>
              <p className="helper-saved">
                {preferenceSummary(preferences) || "No saved preferences yet."}
              </p>
              <label htmlFor="helper-preferences">Replace preferences</label>
              <KeyboardTextarea
                id="helper-preferences"
                value={preferenceEdit}
                onChange={(e) => {
                  setPreferenceEdit(e.target.value);
                  if (turns.length) setLastActive(Date.now());
                }}
                onBlur={() => keyboard.hide()}
                maxLength={300}
                placeholder="Soho, budget £35, table for 4, English"
              />
              <button
                className="helper-primary"
                onClick={() => {
                  keyboard.hide();
                  const parsed = parseMealRequest(preferenceEdit, "2026-10-18");
                  const next = { ...blankPreferences };
                  for (const key of Object.keys(
                    next,
                  ) as (keyof MealPreferences)[])
                    if (parsed[key]) next[key] = parsed[key]!;
                  if (!preferenceSummary(next)) {
                    setNotice(
                      "Add an area, budget, table size, English, relaxed conversation or vegetarian preference. Use Delete preferences to remove everything.",
                    );
                    return;
                  }
                  setPreferences(next);
                  setQuery({});
                  setNotice("Preferences updated. Search conditions reset.");
                }}
              >
                Save preferences
              </button>
              <button
                className="helper-text-button"
                onClick={() => {
                  keyboard.hide();
                  setPreferences({ ...blankPreferences });
                  setPreferenceEdit("");
                  setQuery({});
                  setTurns([]);
                  setInput("");
                  setStartedAt(null);
                  setLastActive(null);
                  setHome(true);
                  setNotice("Preferences deleted and conversation cleared.");
                }}
              >
                Delete preferences
              </button>
              <p className="helper-preference-note">
                Deleting preferences also clears the conversation context that
                used them. Starting a new conversation keeps saved preferences.
              </p>
            </div>
          ) : (
            <>
              <div
                className="helper-conversation"
                ref={conversationRef}
                role="log"
                aria-label="Conversation with Fancy"
              >
                {(home || !turns.length) && (
                  <div className="helper-welcome">
                    <span className="helper-eyebrow">YOUR NEXT GOOD MEAL</span>
                    <h2>What sounds good?</h2>
                    <p>
                      Tell me when, where and what you’d like to spend. Or let’s
                      get your own table started.
                    </p>
                    {!!turns.length && (
                      <button
                        className="helper-resume"
                        onClick={() => {
                          setHome(false);
                          setLastActive(Date.now());
                          setNotice("");
                        }}
                      >
                        <strong>
                          Continue conversation <ArrowRightIcon />
                        </strong>
                        <span>
                          Last active{" "}
                          {helperClock(
                            lastActive || turns[turns.length - 1].time,
                            true,
                          )}
                        </span>
                      </button>
                    )}
                    {!!turns.length && (
                      <p className="helper-session-note">
                        Continue above, or start a new request below.
                      </p>
                    )}
                    <div className="helper-prompts">
                      {prompts.map((prompt) => (
                        <button key={prompt} onClick={() => submit(prompt)}>
                          {prompt}
                          <ArrowRightIcon />
                        </button>
                      ))}
                    </div>
                    <p className="helper-session-note">
                      Conversations restart after 30 minutes without activity.
                      Saved preferences stay until you delete them.
                    </p>
                  </div>
                )}
                {!home && startedAt !== null && (
                  <p className="helper-session-note">
                    Started {helperClock(startedAt, true)} · 30-minute idle
                    limit
                  </p>
                )}
                {!home &&
                  turns.map((turn, index) => (
                    <div className="helper-turn" key={index}>
                      <div className="helper-turn-time">
                        You ·{" "}
                        <time dateTime={new Date(turn.time).toISOString()}>
                          {helperClock(turn.time)}
                        </time>
                      </div>
                      <p className="helper-question">{turn.question}</p>
                      <div className="helper-answer">
                        <strong>
                          Fancy{" "}
                          <time dateTime={new Date(turn.time).toISOString()}>
                            {helperClock(turn.time)}
                          </time>
                        </strong>
                        <p>{turn.reply.text}</p>
                        {turn.reply.meals?.map((meal) => (
                          <button
                            className="helper-meal-card"
                            key={meal.id}
                            onClick={() => {
                              close();
                              onMeal(meal.id);
                            }}
                          >
                            <strong>{meal.title}</strong>
                            <span>
                              {meal.venue} · {meal.area}
                            </span>
                            <span>
                              {meal.date} · {meal.time} · Table for{" "}
                              {meal.capacity}
                            </span>
                            <span>
                              £{meal.min}–{meal.max} per person ·{" "}
                              {meal.capacity - meal.confirmed}{" "}
                              {meal.capacity - meal.confirmed === 1
                                ? "place"
                                : "places"}{" "}
                              left
                            </span>
                            <span>
                              {meal.mood} · {meal.language}
                            </span>
                            <b>
                              View meal <ArrowRightIcon />
                            </b>
                          </button>
                        ))}
                        {turn.reply.preferences && (
                          <div className="helper-draft">
                            <p>{preferenceSummary(turn.reply.preferences)}</p>
                            <button
                              className="helper-primary"
                              disabled={turn.used}
                              onClick={() => {
                                setPreferences(turn.reply.preferences!);
                                setQuery({});
                                setTurns((t) =>
                                  t.map((item, i) =>
                                    i === index
                                      ? { ...item, used: true }
                                      : item,
                                  ),
                                );
                                setNotice(
                                  "Preferences saved. You can change them in My preferences.",
                                );
                              }}
                            >
                              {turn.used ? "Saved" : "Confirm and remember"}
                            </button>
                          </div>
                        )}
                        {turn.reply.draft && (
                          <div className="helper-draft">
                            <span className="helper-eyebrow">
                              DRAFT · FOR YOU TO REVIEW
                            </span>
                            <p>{turn.reply.draft.text}</p>
                            <button
                              className="helper-primary"
                              onClick={() => {
                                close();
                                onAction(
                                  turn.reply.draft!,
                                  turn.reply.query || query,
                                );
                              }}
                            >
                              {turn.reply.draft.kind === "create"
                                ? "Review in Create meal"
                                : turn.reply.draft.kind === "application"
                                  ? "Edit application"
                                  : "Review in meal chat"}
                            </button>
                            <small>
                              {turn.reply.draft.kind === "create"
                                ? "Replaces the current creation draft. Nothing is published."
                                : "Replaces the text in the editor. Nothing is sent."}
                            </small>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              {voiceConsent && (
                <div className="helper-voice-consent">
                  <p>
                    Your browser may send audio to its speech service. Voice
                    uses English (UK). Only the transcript is added here; check
                    it before sending.
                  </p>
                  <button className="helper-primary" onClick={startVoice}>
                    Start voice input
                  </button>
                  <button
                    className="helper-text-button"
                    onClick={() => setVoiceConsent(false)}
                  >
                    Keep typing
                  </button>
                </div>
              )}
              <form
                className="helper-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <label className="helper-input-label" htmlFor="helper-request">
                  Ask about a meal or make a plan
                </label>
                <div className="helper-input-row">
                  <KeyboardInput
                    id="helper-request"
                    value={input}
                    onChange={(e) => {
                      const value = e.target.value;
                      const now = Date.now();
                      if (helperExpired(lastActive, now)) restart(true);
                      else if (turns.length) setLastActive(now);
                      setInput(value);
                    }}
                    onBlur={() => keyboard.hide()}
                    maxLength={1000}
                    placeholder="Friday in Soho, under £35…"
                    autoComplete="off"
                  />
                  {voiceEnabled && (
                    <button
                      type="button"
                      className={`helper-mic ${listening ? "is-listening" : ""}`}
                      aria-label={
                        listening ? "Stop voice input" : "Use voice input"
                      }
                      onClick={() => {
                        keyboard.hide();
                        if (listening) stopVoice();
                        else if (!speechConstructor())
                          setNotice(
                            "Voice input isn’t available in this browser. You can still type your request.",
                          );
                        else setVoiceConsent(true);
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect
                          x="9"
                          y="2"
                          width="6"
                          height="12"
                          rx="3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                        <path
                          d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v4m-4 0h8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                      </svg>
                    </button>
                  )}
                  <button
                    type="submit"
                    className="helper-send"
                    aria-label="Send to Fancy"
                    disabled={!input.trim() || listening}
                    onPointerDown={(e) => e.preventDefault()}
                  >
                    <ArrowRightIcon />
                  </button>
                </div>
              </form>
            </>
          )}
          {notice && (
            <p className="helper-notice" role="status">
              {notice}
            </p>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

function FuturePrototype() {
  const [entrance, setEntrance] = useState<"splash" | "account" | "">("splash");
  const [signedIn, setSignedIn] = useState(false);
  const [afterAuth, setAfterAuth] = useState<Page>("discover");
  const keyboard = useKeyboard();
  const { screenRef } = useScreenPortal();
  // Native field focus may scroll the clipped phone portal. Only the app's
  // inner MobileScroll/filter containers should move, never device chrome.
  useEffect(() => {
    const screen = screenRef.current;
    if (!screen) return;
    const keepFrameAnchored = () => {
      if (screen.scrollTop || screen.scrollLeft)
        screen.scrollTo({ top: 0, left: 0 });
    };
    screen.addEventListener("scroll", keepFrameAnchored);
    return () => screen.removeEventListener("scroll", keepFrameAnchored);
  }, [screenRef]);
  const insets = useKeyboardInsets();
  const [preferences, setPreferences] = useState({
    mealUpdates: true,
    messagePreviews: true,
  });
  const [page, setPage] = useState<Page>("discover");
  const [history, setHistory] = useState<Page[]>([]);
  const [meals, setMeals] = useState<Meal[]>(initialMeals);
  const [selected, setSelected] = useState("supper");
  const [mode, setMode] = useState<"map" | "list">("map");
  const [filters, setFilters] = useState<DiscoveryFilters>({ ...emptyFilters });
  const [pendingFilters, setPendingFilters] = useState<DiscoveryFilters>({
    ...emptyFilters,
  });
  const [selectedArea, setSelectedArea] = useState("Soho");
  const [mapAreas, setMapAreas] = useState<string[] | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [sheet, setSheet] = useState<Sheet>("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmedChats, setConfirmedChats] = useState<Record<string, boolean>>(
    {},
  );
  const [chatArchives, setChatArchives] = useState<Record<string, string[]>>(
    {},
  );
  const [states, setStates] = useState<Record<string, JoinState>>({});
  const [payments, setPayments] = useState<Record<string, PaymentState>>({});
  const [reservedSizes, setReservedSizes] = useState<Record<string, number>>(
    {},
  );
  const [bookings, setBookings] = useState<Record<string, BookingState>>({});
  const [refundValues, setRefundValues] = useState<Record<string, number>>({});
  const [refunds, setRefunds] = useState<
    Record<string, "PENDING" | "REFUNDED" | "FAILED">
  >({});
  const [memberId, setMemberId] = useState("maya");
  const [intro, setIntro] = useState(
    "I’m new to London and would love to meet people over a relaxed meal.",
  );
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mealTab, setMealTab] = useState("Upcoming");
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState<Record<string, string[]>>({});
  const [profile, setProfile] = useState<WelcomeProfile>({
    name: "Alex",
    bio: members.alex.bio,
    life: "New to London",
    language: "English",
    interests: "Food, photography, travel",
    work: "Creative strategist",
    school: "",
    hometown: "",
  });
  const [draftProfile, setDraftProfile] = useState(profile);
  const [createStep, setCreateStep] = useState(0);
  const [draft, setDraft] = useState(initialDraft);
  const [review, setReview] = useState("");
  const [wants, setWants] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [mutual, setMutual] = useState(false);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [feedbackTarget, setFeedbackTarget] = useState({
    mealId: "past-supper",
    title: "A little supper club",
    date: "2026-10-15",
    memberId: "maya",
  });
  const [attendanceReports, setAttendanceReports] = useState<
    AttendanceReport[]
  >([]);
  const [mealExperiences, setMealExperiences] = useState<MealExperience[]>([]);
  const [experienceScore, setExperienceScore] = useState("");
  const [experienceAgain, setExperienceAgain] = useState("");
  const [reasonChoices, setReasonChoices] = useState<ExperienceReason[]>([]);
  const [experienceError, setExperienceError] = useState("");
  const targetMeal = meals.find((m) => m.id === feedbackTarget.mealId);
  const postMealContext: MealContext = feedbackTarget.mealId.startsWith(
    "past-supper",
  )
    ? {
        id: feedbackTarget.mealId,
        ended: true,
        cancelled: false,
        hostId: feedbackTarget.mealId === "past-supper-host" ? "alex" : "maya",
        participantIds: ["maya", "emma", "alex"],
      }
    : {
        id: feedbackTarget.mealId,
        ended: !!completed[feedbackTarget.mealId],
        cancelled: bookings[feedbackTarget.mealId] === "CANCELLED",
        hostId: targetMeal?.host || "",
        participantIds: targetMeal
          ? [...new Set([targetMeal.host, ...targetMeal.members])]
          : [],
      };
  const myAttendance = attendanceResult(
    attendanceReports,
    feedbackTarget.mealId,
    "alex",
  );
  const savedExperience = mealExperiences.find(
    (r) => r.mealId === feedbackTarget.mealId && r.userId === "alex",
  );
  useEffect(() => {
    const row = mealExperiences.find(
      (r) => r.mealId === feedbackTarget.mealId && r.userId === "alex",
    );
    setExperienceScore(row ? String(row.score) : "");
    setExperienceAgain(row ? String(row.again) : "");
    setReasonChoices(row?.reasons || []);
    setExperienceError("");
  }, [feedbackTarget.mealId, mealExperiences]);
  const directKey = `direct-${feedbackTarget.memberId}`;
  const [blockedMembers, setBlockedMembers] = useState<Record<string, boolean>>(
    {},
  );
  const blocked = !!blockedMembers[feedbackTarget.memberId];
  const reportMemberId = page === "member" ? memberId : feedbackTarget.memberId;
  const [report, setReport] = useState("");
  const [scenarioPayment, setScenarioPayment] = useState(false);
  const [beforeDeadline, setBeforeDeadline] = useState(true);
  const [platformCancel, setPlatformCancel] = useState(false);
  const [hostDecision, setHostDecision] = useState<Record<string, string>>({});
  const current = meals.find((m) => m.id === selected) || meals[0];
  const join = states[current.id] || "NONE";
  const payment = payments[current.id] || "UNPAID";
  const booking = bookings[current.id] || current.booking;
  const alternativeTime = alternativeReservationSlot(current);
  const matches = eligibleMeals(meals, filters);
  const activeCount = Object.values(filters).filter((value) =>
    value.trim(),
  ).length;
  const groups = groupMealsByArea(matches);
  const areaGroup =
    groups.find((group) => group.area === selectedArea) || groups[0];
  const areaMeals = areaGroup?.meals || [];
  const featured = areaMeals.find((m) => m.id === selected) || areaMeals[0];
  const featuredIndex = areaMeals.findIndex((m) => m.id === featured?.id);
  const pendingMatches = eligibleMeals(meals, pendingFilters);
  const openFilters = (target: "date" | "size" | "filters") => {
    keyboard.hide();
    setPendingFilters({ ...filters });
    setShowCalendar(target === "date");
    setSheet(target);
  };
  const applyFilters = () => {
    keyboard.hide();
    setFilters({ ...pendingFilters });
    setSheet("");
  };
  const clearFilters = () => setFilters({ ...emptyFilters });
  const selectArea = (area: string) => {
    const group = groups.find((g) => g.area === area);
    if (group) {
      setSelectedArea(area);
      setSelected(group.meals[0].id);
    }
  };
  const profileComplete =
    profile.name.trim().length >= 2 &&
    profile.bio.trim().length >= 20 &&
    !!profile.language.trim() &&
    !!profile.life &&
    !!profile.interests.trim();
  const notify = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  };
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const go = (to: Page) => {
    setToast("");
    if (!signedIn && needsAccount(to)) {
      keyboard.hide();
      setAfterAuth(to);
      setEntrance("account");
      return;
    }
    keyboard.hide();
    setError("");
    setSheet("");
    setHistory((h) => [...h, page]);
    setPage(to);
  };
  const root = (to: Page) => {
    setToast("");
    if (!signedIn && needsAccount(to)) {
      keyboard.hide();
      setAfterAuth(to);
      setEntrance("account");
      return;
    }
    keyboard.hide();
    setError("");
    setSheet("");
    setHistory([]);
    setPage(to);
  };
  const back = () => {
    setToast("");
    keyboard.hide();
    setError("");
    setHistory((h) => {
      setPage(h[h.length - 1] || "discover");
      return h.slice(0, -1);
    });
  };
  const openMeal = (meal: Meal) => {
    setSelected(meal.id);
    go("detail");
  };
  const openMember = (id: string) => {
    if (id === "alex") {
      go("profile");
      return;
    }
    setMemberId(id);
    go("member");
  };
  const updateJoin = (state: JoinState) =>
    setStates((s) => ({ ...s, [current.id]: state }));
  const countUp = (mealId = current.id) => {
    setConfirmedChats((s) => ({ ...s, [mealId]: true }));
    setMeals((ms) =>
      ms.map((m) => (m.id === mealId ? addConfirmedMember(m, "alex") : m)),
    );
  };
  const submitApplication = () => {
    try {
      const next = applyToMeal(current, join, intro, profileComplete);
      updateJoin(next);
      go("status");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const approveMeal = (meal: Meal) => {
    try {
      const next = approveApplication(meal, states[meal.id] || "NONE");
      setStates((s) => ({ ...s, [meal.id]: next }));
      if (next === "CONFIRMED") countUp(meal.id);
      setError("");
      if (preferences.mealUpdates)
        notify(
          `${members[meal.host]?.name || "Your host"} approved your application.${next === "CONFIRMED" ? " Your group chat is ready." : " Confirm your seat with payment."}`,
        );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const approve = () => approveMeal(current);
  const pay = () => {
    if (busy || !consent) return;
    setBusy(true);
    setError("");
    setTimeout(() => {
      try {
        const r = settleSeatPayment(join, payment, !scenarioPayment, booking);
        updateJoin(r.join);
        setPayments((p) => ({ ...p, [current.id]: r.payment }));
        if (r.payment === "PAID") {
          if (payment !== "PAID") countUp();
          setBookings((b) => ({ ...b, [current.id]: r.booking }));
          go("booking");
        } else setError("Payment declined. Your seat is held. Try again.");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }, 650);
  };
  const cancelParticipation = () => {
    if (join === "CONFIRMED")
      setChatArchives((a) => ({
        ...a,
        [current.id]: [...(messages[current.id] || [])],
      }));
    if (join === "CONFIRMED")
      setMeals((ms) =>
        ms.map((m) =>
          m.id === current.id
            ? {
                ...m,
                confirmed: Math.max(1, m.confirmed - 1),
                members: m.members.filter((id) => id !== "alex"),
              }
            : m,
        ),
      );
    updateJoin("CANCELLED");
    setRefundValues((r) => ({
      ...r,
      [current.id]:
        payment === "PAID"
          ? refundAmount(current.deposit, beforeDeadline, platformCancel)
          : 0,
    }));
    if (
      payment === "PAID" &&
      refundAmount(current.deposit, beforeDeadline, platformCancel) > 0
    )
      setRefunds((r) => ({ ...r, [current.id]: "PENDING" }));
    setSheet("");
    notify("Participation cancelled. See your refund status.");
  };
  const publish = () => {
    const issue =
      validateArrangement(
        { ...draft, max: draft.cost === "menu" ? draft.min : draft.max },
        "costs",
      ) ||
      (!draft.accepted ? "Confirm the meal details before publishing." : "") ||
      validateMeal(
        draft.title,
        draft.description,
        draft.capacity,
        draft.min,
        draft.cost === "menu" ? draft.min : draft.max,
      );
    if (issue) {
      setError(issue);
      return;
    }
    const meal: Meal = {
      id: `created-${Date.now()}`,
      title: draft.title.trim(),
      venue: draft.venue,
      area: createVenues.find((v) => v.name === draft.venue)!.area,
      date: draft.date,
      time: draft.time,
      capacity: draft.capacity,
      confirmed: 1,
      min: draft.min,
      max: draft.cost === "menu" ? draft.min : draft.max,
      deposit: createDueNow(draft),
      language: draft.language,
      mood: draft.mood,
      description: draft.description.trim(),
      host: "alex",
      members: ["alex"],
      x: initialMeals.find(
        (m) =>
          m.area === createVenues.find((v) => v.name === draft.venue)!.area,
      )!.x,
      y: initialMeals.find(
        (m) =>
          m.area === createVenues.find((v) => v.name === draft.venue)!.area,
      )!.y,
      cuisine: createVenues.find((v) => v.name === draft.venue)!.cuisine,
      dietary: ["Vegetarian options"],
      booking: draft.booking === "external" ? "CONFIRMED" : "PENDING",
      costMode:
        draft.cost === "offline"
          ? "OFFLINE"
          : draft.cost === "menu"
            ? "FIXED_MENU"
            : "DEPOSIT",
      owned: true,
      reservationSource: draft.booking === "external" ? "external" : "in-app",
    };
    setMeals((ms) => [meal, ...ms]);
    setSelected(meal.id);
    setCreateStep(0);
    setDraft(initialDraft);
    go("detail");
    notify("Your meal is published. Your table starts here.");
  };
  const statusButton = () => {
    if (current.owned)
      return (
        <Primary onClick={() => go("host")}>
          Manage applications <ArrowRightIcon />
        </Primary>
      );
    if (join === "CONFIRMED")
      return (
        <Primary onClick={() => go("booking")}>
          View your booking <ArrowRightIcon />
        </Primary>
      );
    if (join === "APPROVED_PAYMENT_PENDING")
      return (
        <Primary
          onClick={() => {
            setConsent(false);
            go("checkout");
          }}
        >
          Pay {money(current.deposit)}{" "}
          {current.costMode === "FIXED_MENU" ? "menu fee" : "deposit"}{" "}
          <ArrowRightIcon />
        </Primary>
      );
    if (join === "PENDING")
      return (
        <Primary secondary onClick={() => go("status")}>
          View application <ArrowRightIcon />
        </Primary>
      );
    if (join === "CANCELLED" || join === "DECLINED")
      return (
        <Primary secondary onClick={() => root("discover")}>
          Find another table
        </Primary>
      );
    return (
      <Primary
        disabled={current.confirmed >= current.capacity}
        onClick={() => go("apply")}
      >
        {current.confirmed >= current.capacity
          ? "This table is full"
          : "Apply to join"}{" "}
        <ArrowRightIcon />
      </Primary>
    );
  };
  const mealCard = (m: Meal, compact = false) => (
    <article className={`meal-card ${compact ? "compact" : ""}`} key={m.id}>
      <button
        className="meal-card-hit"
        onClick={() => openMeal(m)}
        aria-label={`Open ${m.title}`}
      />
      <div className="meal-photo">
        <img
          src="/images/restaurant.png"
          alt="A warm, leafy London restaurant"
        />
      </div>
      <div className="meal-copy">
        <h3>{m.title}</h3>
        <p className="venue-name">{m.venue}</p>
        <p>
          <SewingPinIcon />
          {m.area}, London
        </p>
        <p>
          <CalendarIcon />
          {longDate(m.date)} · {m.time}
        </p>
        <p>
          {m.min === m.max ? money(m.min) : `${money(m.min)}–${m.max}`} per
          person
        </p>
        <p>
          <PersonIcon />
          Table for {m.capacity} · {m.confirmed} confirmed
        </p>
        <div className="avatars">
          {m.members.slice(0, 3).map((id) => (
            <Avatar
              key={id}
              id={id}
              onClick={() => openMember(id)}
              size={compact ? 29 : 32}
            />
          ))}
        </div>
      </div>
      {!compact && (
        <p className="card-caption">
          {m.mood} · {m.language}
        </p>
      )}
      {compact && <span className="pill card-mood">{m.mood}</span>}
    </article>
  );
  const screenTitles: Partial<Record<Page, string>> = {
    detail: "The table",
    member: "Meet your table",
    apply: "Request a seat",
    status: "Your application",
    checkout: "Confirm your seat",
    booking: "Your meal",
    chat: current.title,
    create: "Create a meal",
    edit: "Edit profile",
    review: "After the meal",
    host: "Your guest list",
    direct: members[feedbackTarget.memberId].name,
    settings: "Settings",
  };
  const topLevel = ["discover", "meals", "inbox", "profile"].includes(page);
  const renderPage = () => {
    if (page === "discover")
      return (
        <div className="discovery">
          <header className="discover-header">
            <button
              className="city"
              onClick={() =>
                notify("London is our first city. More tables will follow.")
              }
            >
              London <ChevronDownIcon />
            </button>
            <h1>{BRAND.invitation}</h1>
            <p className="tagline">{BRAND.slogan}</p>
            <div className="discover-controls">
              <button
                onClick={() => openFilters("date")}
                aria-label="Filter by date"
              >
                <CalendarIcon />
                {filters.date ? longDate(filters.date) : "Any date"}
                <ChevronDownIcon />
              </button>
              <button
                onClick={() => openFilters("size")}
                aria-label="Filter by table size"
              >
                <PersonIcon />
                {filters.size
                  ? filters.size === "small"
                    ? "3–6 people"
                    : filters.size === "duo"
                      ? "2 people"
                      : `${filters.size} people`
                  : "Table size"}
                <ChevronDownIcon />
              </button>
              <div className="view-toggle">
                <button
                  aria-label="List view"
                  aria-pressed={mode === "list"}
                  className={mode === "list" ? "selected" : ""}
                  onClick={() => setMode("list")}
                >
                  <ListBulletIcon />
                </button>
                <button
                  aria-label="Map view"
                  aria-pressed={mode === "map"}
                  className={mode === "map" ? "selected" : ""}
                  onClick={() => setMode("map")}
                >
                  <GlobeIcon />
                </button>
              </div>
              <button
                className="more-filter"
                aria-label="More filters"
                onClick={() => openFilters("filters")}
              >
                <MixerHorizontalIcon />
                {activeCount > 0 && (
                  <span className="filter-count">{activeCount}</span>
                )}
              </button>
            </div>
          </header>
          {mode === "map" ? (
            <>
              <div className="map-canvas">
                <DemoMap
                  label="Explore meals map"
                  selected={areaGroup?.area || ""}
                  spots={groups.map((group) => ({
                    id: group.area,
                    label:
                      group.area +
                      ": " +
                      group.meals.length +
                      (group.meals.length === 1 ? " meal" : " meals"),
                    text: String(group.meals.length),
                    x: group.x,
                    y: group.y,
                  }))}
                  onSelect={(area) => {
                    setMapAreas(null);
                    selectArea(area);
                  }}
                  onSearch={(areas) => {
                    setMapAreas(areas);
                    if (areas.length) selectArea(areas[0]);
                  }}
                />
                <span className="map-key">Numbers = meals in each area</span>
                <ReviewOnly>
                  <span className="map-note">
                    Illustrative map · Demo locations
                  </span>
                </ReviewOnly>
              </div>
              <section className="map-preview" aria-label="Selected area meals">
                {mapAreas?.length === 0 ? (
                  <div className="map-empty">
                    <strong>No meals in this area</strong>
                    <p>Move the map or return to central London.</p>
                  </div>
                ) : (
                  featured && (
                    <>
                      <button
                        className="area-results-trigger"
                        aria-label={`View all ${areaMeals.length} ${areaMeals.length === 1 ? "meal" : "meals"} in ${areaGroup.area}`}
                        onClick={() => {
                          keyboard.hide();
                          setSheet("area");
                        }}
                      >
                        <span className="sheet-grip" />
                        <span>
                          <strong>
                            {areaMeals.length}{" "}
                            {areaMeals.length === 1 ? "meal" : "meals"} in{" "}
                            {areaGroup.area}
                          </strong>
                          <span>
                            View all <ChevronUpIcon />
                          </span>
                        </span>
                      </button>
                      {mealCard(featured)}
                      <div className="event-pager">
                        <span>
                          Meal {featuredIndex + 1} of {areaMeals.length}
                        </span>
                        <div>
                          <button
                            aria-label="Previous meal in this area"
                            disabled={featuredIndex <= 0}
                            onClick={() =>
                              setSelected(areaMeals[featuredIndex - 1].id)
                            }
                          >
                            <ChevronLeftIcon />
                          </button>
                          <button
                            aria-label="Next meal in this area"
                            disabled={featuredIndex >= areaMeals.length - 1}
                            onClick={() =>
                              setSelected(areaMeals[featuredIndex + 1].id)
                            }
                          >
                            <ChevronRightIcon />
                          </button>
                        </div>
                      </div>
                    </>
                  )
                )}
                {!featured && (
                  <div className="empty">
                    <MagnifyingGlassIcon />
                    <h3>No tables match just yet</h3>
                    <p>Try another date or a wider budget.</p>
                    <Primary onClick={clearFilters}>Clear filters</Primary>
                  </div>
                )}
              </section>
            </>
          ) : (
            <MobileScroll className="discover-list">
              <div className="list-content">
                <div className="section-heading">
                  <h2>A seat for you</h2>
                  <span>{matches.length} meals</span>
                </div>
                {matches.map((m) => (
                  <div className="list-meal" key={m.id}>
                    {mealCard(m, true)}
                  </div>
                ))}
                {!matches.length && (
                  <div className="empty">
                    <h3>No meals found</h3>
                    <p>Change your filters to find another table.</p>
                    <Primary onClick={() => setFilters({ ...emptyFilters })}>
                      Clear filters
                    </Primary>
                  </div>
                )}
                <ReviewOnly>
                  <p className="demo-note">
                    Fictional meals · Reservations and payments are simulated.
                  </p>
                </ReviewOnly>
              </div>
            </MobileScroll>
          )}
        </div>
      );
    if (page === "detail")
      return (
        <>
          <img
            className="detail-hero"
            src="/images/restaurant.png"
            alt="Warm restaurant interior"
          />
          <div className="body-pad">
            <div className="eyebrow">
              {current.area.toUpperCase()} ·{" "}
              {current.capacity === 2 ? "A TABLE FOR TWO" : "A SMALL TABLE"}
            </div>
            <h1>{current.title}</h1>
            <div className="fact-grid">
              <div>
                <CalendarIcon />
                <strong>{longDate(current.date)}</strong>
                <span>{current.time} · London time</span>
              </div>
              <div>
                <PersonIcon />
                <strong>
                  {current.confirmed} of {current.capacity} confirmed · Minimum{" "}
                  {current.capacity === 2 ? 2 : 3} including the host
                </strong>
                <span>Including the host</span>
              </div>
            </div>
            <div className="host-line">
              <Avatar
                id={current.host}
                onClick={() => openMember(current.host)}
                size={44}
              />
              <div>
                <small>Your host</small>
                <button onClick={() => openMember(current.host)}>
                  {current.host === "alex"
                    ? profile.name
                    : members[current.host].name}{" "}
                  <ArrowRightIcon />
                </button>
              </div>
              <span className="pill">{current.language}</span>
            </div>
            <h2>A little about this meal</h2>
            <p className="prose">{current.description}</p>
            <div className="tags">
              <span>{current.mood}</span>
              <span>Friendship first</span>
            </div>
            <h2>Who’s coming</h2>
            <div className="people-row">
              {current.members.map((id) => (
                <button key={id} onClick={() => openMember(id)}>
                  <Avatar id={id} size={49} />
                  <span>
                    {id === "alex" ? profile.name : members[id]?.name}
                  </span>
                </button>
              ))}
              {current.confirmed < current.capacity && (
                <div className="open-seat">
                  <PersonIcon />
                  <span>
                    {current.owned || join === "CONFIRMED"
                      ? "Open seat"
                      : "Your seat?"}
                  </span>
                </div>
              )}
            </div>
            <h2>The restaurant</h2>
            <div className="venue-line">
              <SewingPinIcon />
              <div>
                <strong>{current.venue}</strong>
                <p>{current.area}, London</p>
                <span
                  className={`status-tag ${booking === "CONFIRMED" ? "good" : ""}`}
                >
                  {booking === "CONFIRMED"
                    ? "Restaurant booked"
                    : booking === "FAILED"
                      ? "Booking needs attention"
                      : bookingStatusLabel(booking)}
                </span>
              </div>
            </div>
            <a
              className="maps-link"
              href={googleMapsAreaUrl(current.area)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open {current.area} in Google Maps <ExternalLinkIcon />
            </a>
            <p className="map-destination-note">
              {current.reservationSource === "external"
                ? "Reservation reported by the host; not verified by the app. "
                : ""}
              Google Maps opens the neighbourhood.
            </p>
            <h2>Keeping costs clear</h2>
            <div className="price-row">
              <span>Expected spend per person</span>
              <strong>
                {current.min === current.max
                  ? money(current.min)
                  : `${money(current.min)}–${current.max}`}
              </strong>
            </div>
            <div className="price-row">
              <span>
                {current.costMode === "FIXED_MENU"
                  ? "Fixed sharing menu"
                  : current.deposit
                    ? "Deposit after approval"
                    : "Pay at the restaurant"}
              </span>
              <strong>
                {current.deposit ? money(current.deposit) : "Split the bill"}
              </strong>
            </div>
            <p className="muted">
              {current.costMode === "FIXED_MENU"
                ? "Menu fee paid in-app. Drinks and service are paid separately at the restaurant."
                : current.deposit
                  ? "Your deposit goes toward your bill. Pay the rest at the restaurant; everyone pays their own share."
                  : "No payment is due in the app. Everyone pays their own share at the restaurant."}
            </p>
            <div className="notice">
              <InfoCircledIcon />
              <span>
                {current.deposit
                  ? "Full refund until 24 hours before this meal; no refund after that. Host cancellation or a failed reservation receives a full refund."
                  : "No in-app payment to refund. Let the host know if your plans change."}
              </span>
            </div>
            <ReviewOnly>
              <div className="demo-note">
                Demo only. No real booking or payment is made.
              </div>
            </ReviewOnly>
            {statusButton()}
            {current.owned && (
              <Primary secondary onClick={() => go("booking")}>
                Manage reservation <CalendarIcon />
              </Primary>
            )}
          </div>
        </>
      );
    if (page === "member") {
      const m = members[memberId];
      return (
        <div className="body-pad">
          <div className="profile-heading">
            <Avatar id={m.id} size={88} />
            <h1>{m.name}</h1>
            <p>{m.background}</p>
            <span className="pill">{m.life}</span>
          </div>
          <h2>A little about me</h2>
          <p className="prose">{m.bio}</p>
          <h2>We could talk about</h2>
          <div className="tags">
            {m.interests.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <h2>Languages</h2>
          <p>
            <GlobeIcon style={iconStyle} /> {m.language}
          </p>
          <h2>From people at the table</h2>
          <div className="quote">
            “Made everyone feel included, even on my first meal. Would happily
            share a table again.”
            <small>
              {m.id === "emma" ? "Maya" : "Emma"} · Shared a meal in September
            </small>
          </div>
          <ReviewOnly>
            <p className="muted">
              Fictional profile and sample reference. Background information is
              self-described.
            </p>
          </ReviewOnly>
          {blockedMembers[memberId] && (
            <div className="notice">
              You have blocked this member. Private contact is disabled.
            </div>
          )}
          <button className="text-action" onClick={() => setSheet("report")}>
            Report or block this member
          </button>
          <Primary secondary onClick={back}>
            Go back
          </Primary>
        </div>
      );
    }
    if (page === "apply")
      return (
        <div className="body-pad">
          <span className="eyebrow">A GOOD MEAL STARTS WITH HELLO</span>
          <h1>Pull up a chair.</h1>
          <p className="prose">
            Tell {members[current.host]?.name || "your host"} a little about
            yourself and why you’d like to join.
          </p>
          <div className="small-meal">
            <img src="/images/restaurant.png" alt="Restaurant" />
            <div>
              <strong>{current.title}</strong>
              <p>
                {longDate(current.date)} · {current.time}
              </p>
              <small>
                {current.confirmed} of {current.capacity} confirmed
              </small>
            </div>
          </div>
          <Field
            label="Your introduction"
            hint="20–300 characters. Your host will see this with your profile."
          >
            <KeyboardTextarea
              value={intro}
              maxLength={300}
              onChange={(e) => setIntro(e.target.value)}
              onBlur={() => keyboard.hide()}
              rows={5}
            />
          </Field>
          <div className="host-line">
            <Avatar id="alex" size={42} />
            <div>
              <strong>{profile.name}</strong>
              <p>
                {profile.life} · {profile.language}
              </p>
            </div>
            <button
              className="text-action"
              onClick={() => {
                setDraftProfile(profile);
                go("edit");
              }}
            >
              Edit
            </button>
          </div>
          {!profileComplete && (
            <div className="notice">Complete your profile before applying.</div>
          )}
          <div className="notice">
            <LockClosedIcon />
            <span>
              Applying doesn’t reserve a seat or charge you. Your host reviews
              each request.
            </span>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {join === "NONE" || join === "WITHDRAWN" ? (
            <Primary onClick={submitApplication}>
              Send request <ArrowRightIcon />
            </Primary>
          ) : (
            <Primary onClick={() => go("status")}>
              View application <ArrowRightIcon />
            </Primary>
          )}
        </div>
      );
    if (page === "status")
      return (
        <div className="body-pad">
          <div className="state-illustration">
            <PersonIcon />
          </div>
          <h1>
            {join === "PENDING"
              ? "Your hello is on its way."
              : join === "APPROVED_PAYMENT_PENDING"
                ? "There’s a seat for you."
                : join === "CONFIRMED"
                  ? "You’re at the table."
                  : join === "DECLINED"
                    ? "Another table awaits."
                    : join === "CANCELLED"
                      ? "Your participation is cancelled."
                      : "Your request is withdrawn."}
          </h1>
          <p className="prose">
            {join === "PENDING"
              ? `${members[current.host]?.name || "Your host"} will review your introduction. We’ll let you know when there’s an update.`
              : join === "APPROVED_PAYMENT_PENDING"
                ? "Your host approved your request. Pay to confirm your seat; your seat is held for 30 minutes."
                : join === "CONFIRMED"
                  ? "Everything you need for your meal is in one place."
                  : "This request is closed. You can discover another meal."}
          </p>
          <div className="summary-box">
            <strong>{current.title}</strong>
            <p>
              {longDate(current.date)} · {current.time}
            </p>
            <span className="status-tag">{labels[join]}</span>
          </div>
          <Primary secondary onClick={() => root("inbox")}>
            Track in Inbox <ChatBubbleIcon />
          </Primary>
          {join === "PENDING" && (
            <>
              <ReviewOnly>
                <div className="demo-panel">
                  <span>DEMO PREVIEW</span>
                  <p>Try the next step without waiting for a real host.</p>
                  <Primary secondary onClick={approve}>
                    Preview host approval
                  </Primary>
                  <button
                    className="text-action"
                    onClick={() => {
                      updateJoin("DECLINED");
                      notify("Application declined.");
                    }}
                  >
                    Preview declined request
                  </button>
                </div>
              </ReviewOnly>
              <button
                className="text-action"
                onClick={() => {
                  updateJoin("WITHDRAWN");
                  notify("Request withdrawn.");
                }}
              >
                Withdraw request
              </button>
            </>
          )}
          {join !== "PENDING" && statusButton()}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      );
    if (page === "checkout")
      return (
        <div className="body-pad">
          <div className="eyebrow">ONE MORE THING, THEN YOU’RE IN</div>
          <h1>Make this seat yours.</h1>
          <p className="prose">
            {current.costMode === "FIXED_MENU"
              ? "Pay for your fixed sharing menu."
              : "Your deposit is deducted from your restaurant bill."}
          </p>
          <div className="summary-box">
            <strong>{current.title}</strong>
            <p>
              {longDate(current.date)} · {current.time}
            </p>
            <div className="price-row">
              <span>
                {current.costMode === "FIXED_MENU"
                  ? "Fixed menu"
                  : "Seat deposit"}
              </span>
              <strong>{money(current.deposit)}</strong>
            </div>
            <div className="price-row">
              <span>Service fee</span>
              <strong>£0</strong>
            </div>
            <div className="price-row total">
              <span>Due now</span>
              <strong>{money(current.deposit)}</strong>
            </div>
          </div>
          <h2>Payment method</h2>
          <div className="payment-card">
            <ReaderIcon />
            <div>
              <strong>Visa •••• 4242</strong>
              <ReviewOnly>
                <small>No real card details needed</small>
              </ReviewOnly>
            </div>
            <CheckCircledIcon />
          </div>
          <ReviewOnly>
            <div className="notice">
              <LockClosedIcon />
              <span>Demo payment only. You will not be charged.</span>
            </div>
          </ReviewOnly>
          <label className="check-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I accept this meal’s terms: full refund until 24 hours before the
              meal; no refund after that. Host cancellation or booking failure
              is refunded in full.
            </span>
          </label>
          <ReviewOnly>
            <label className="check-row demo-option">
              <input
                type="checkbox"
                checked={scenarioPayment}
                onChange={(e) => setScenarioPayment(e.target.checked)}
              />
              <span>Preview a failed payment</span>
            </label>
          </ReviewOnly>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Primary
            disabled={!consent || busy || join !== "APPROVED_PAYMENT_PENDING"}
            onClick={pay}
          >
            {busy
              ? "Processing payment…"
              : `Pay ${money(current.deposit)} ${current.costMode === "FIXED_MENU" ? "menu fee" : "deposit"}`}{" "}
            {!busy && <ArrowRightIcon />}
          </Primary>
        </div>
      );
    if (page === "booking")
      return (
        <div className="body-pad">
          <div
            className={`state-illustration ${booking === "FAILED" ? "warning" : ""}`}
          >
            {booking === "FAILED" ? (
              <ExclamationTriangleIcon />
            ) : (
              <CheckCircledIcon />
            )}
          </div>
          <h1>
            {join === "CANCELLED"
              ? "Plans have changed."
              : booking === "FAILED"
                ? "Let’s find another slot."
                : booking === "PENDING"
                  ? current.owned
                    ? "Your table is taking shape."
                    : "Your seat is ready."
                  : "See you at the table."}
          </h1>
          <p className="prose">
            {join === "CANCELLED"
              ? "Your place has been released. Any eligible refund is shown below."
              : booking === "FAILED"
                ? current.owned
                  ? "The restaurant couldn’t confirm this slot. Choose an alternative time for your group."
                  : "The restaurant couldn’t confirm this slot. Your host is arranging an alternative. Chat with your table or cancel for a full refund."
                : booking === "PENDING"
                  ? current.owned
                    ? "Check your confirmed guests, then finalise the restaurant reservation below."
                    : "You have a confirmed seat. Your host is finalising the restaurant reservation."
                  : "A little good food and a few new faces await."}
          </p>
          <div className="ticket">
            <div className="ticket-head">
              <span>YOUR TABLE</span>
              <strong>{current.venue}</strong>
              <p>{current.area}, London</p>
            </div>
            <div className="fact-grid">
              <div>
                <small>WHEN</small>
                <strong>{longDate(current.date)}</strong>
                <span>{current.time} · London</span>
              </div>
              <div>
                <small>PEOPLE</small>
                <strong>
                  {current.confirmed} of {current.capacity}
                </strong>
                <span>Confirmed seats</span>
              </div>
            </div>
            <div className="ticket-status">
              <span>Restaurant</span>
              <strong>
                {booking === "CONFIRMED"
                  ? "Confirmed"
                  : booking === "FAILED"
                    ? "Confirmation failed"
                    : booking === "CANCELLED"
                      ? "Cancelled"
                      : "Awaiting confirmation"}
              </strong>
            </div>
            <div className="ticket-status">
              <span>{current.owned ? "Guest payments" : "Payment"}</span>
              <strong>
                {current.owned
                  ? hostDecision[current.id] === "Confirmed"
                    ? "Guest confirmed"
                    : "Awaiting guests"
                  : payment === "PAID"
                    ? `${money(current.deposit)} paid`
                    : "Pay at restaurant"}
              </strong>
            </div>
            {refunds[current.id] && (
              <div className="ticket-status">
                <span>Refund · {money(refundValues[current.id] || 0)}</span>
                <strong>
                  {refunds[current.id] === "REFUNDED"
                    ? "Refunded"
                    : refunds[current.id] === "FAILED"
                      ? "Needs attention"
                      : "Processing"}
                </strong>
              </div>
            )}
          </div>
          {current.owned && (
            <>
              <Primary
                disabled={
                  (booking === "CONFIRMED" &&
                    !reservationNeedsUpdate(
                      booking,
                      reservedSizes[current.id] ?? current.capacity,
                      current.confirmed,
                    )) ||
                  booking === "CANCELLED" ||
                  booking === "FAILED" ||
                  !groupReady(current.capacity, current.confirmed)
                }
                onClick={() => {
                  setBookings((b) => ({ ...b, [current.id]: "CONFIRMED" }));
                  setReservedSizes((all) => ({
                    ...all,
                    [current.id]: current.confirmed,
                  }));
                  notify(
                    `Reservation confirmed for ${current.confirmed} people.`,
                  );
                }}
              >
                {booking === "CONFIRMED"
                  ? reservationNeedsUpdate(
                      booking,
                      reservedSizes[current.id] ?? current.capacity,
                      current.confirmed,
                    )
                    ? `Update reservation for ${current.confirmed} people`
                    : "Reservation confirmed"
                  : `Confirm reservation for ${current.confirmed} people`}
              </Primary>
              <p className="muted">
                {groupReady(current.capacity, current.confirmed)
                  ? "Confirm the reservation for the current number of confirmed guests."
                  : "At least 3 confirmed guests are needed for a small group, or both guests for a table for two."}
              </p>
              <Primary secondary onClick={() => go("host")}>
                Manage guest list
              </Primary>
            </>
          )}
          {(join === "CONFIRMED" || current.owned) &&
            booking !== "CANCELLED" && (
              <Primary onClick={() => go("chat")}>
                Meet your table in chat <ChatBubbleIcon />
              </Primary>
            )}
          {booking === "FAILED" && current.owned && (
            <Primary
              disabled={!alternativeTime}
              onClick={() => {
                setBookings((b) => ({ ...b, [current.id]: "CONFIRMED" }));
                setMeals((ms) =>
                  ms.map((m) =>
                    m.id === current.id ? { ...m, time: alternativeTime } : m,
                  ),
                );
                setReservedSizes((all) => ({
                  ...all,
                  [current.id]: current.confirmed,
                }));
                notify(
                  `Restaurant confirmed the alternative ${alternativeTime} slot.`,
                );
              }}
            >
              {alternativeTime
                ? `Choose available slot · ${alternativeTime}`
                : "No alternative times available"}
            </Primary>
          )}
          {join === "CONFIRMED" && (
            <button
              className="text-action danger"
              onClick={() => {
                setPlatformCancel(booking === "FAILED");
                setSheet("cancel");
              }}
            >
              Cancel my participation
            </button>
          )}
          <ReviewOnly>
            <button
              className="text-action"
              onClick={() => setSheet("scenarios")}
            >
              Explore demo outcomes
            </button>
          </ReviewOnly>
          {completed[current.id] && (
            <Primary secondary onClick={() => go("review")}>
              Leave feedback
            </Primary>
          )}
        </div>
      );
    if (page === "chat" || page === "direct") {
      const direct = page === "direct";
      const speaker = current.members.find((id) => id !== "alex") || "maya";
      const chatAccess = groupChatAccess(
        current,
        join,
        confirmedChats[current.id],
        booking,
      );
      const allowed = direct ? mutual && !blocked : chatAccess !== "locked";
      return (
        <div className="body-pad chat-body">
          {!allowed ? (
            <div className="empty">
              <LockClosedIcon />
              <h2>
                {direct
                  ? "Connect by mutual choice"
                  : "Your chat opens after confirmation"}
              </h2>
              <p>Continue from your meal to meet the people at your table.</p>
              <Primary onClick={() => go("detail")}>View meal</Primary>
            </div>
          ) : (
            <>
              <div className="chat-pinned">
                <CalendarIcon />
                <div>
                  <strong>
                    {direct
                      ? "You both want to meet again"
                      : `${longDate(current.date)} · ${current.time}`}
                  </strong>
                  <p>
                    {direct
                      ? `Start a conversation or invite ${members[feedbackTarget.memberId].name} to another meal.`
                      : `${current.venue} · ${bookingStatusLabel(booking)}`}
                  </p>
                </div>
              </div>
              {!direct && chatAccess === "read-only" && (
                <div className="notice">
                  <LockClosedIcon />
                  <span>
                    Archived conversation · read-only. Your participation has
                    ended or this meal was cancelled. No new group messages will
                    be delivered.
                  </span>
                </div>
              )}
              <p className="chat-date">
                {!direct && chatAccess === "read-only" ? "ARCHIVE" : "TODAY"}
              </p>
              <div className="chat-message">
                <Avatar
                  id={direct ? feedbackTarget.memberId : speaker}
                  size={30}
                />
                <div>
                  <small>
                    {direct
                      ? members[feedbackTarget.memberId].name
                      : members[speaker].name}
                  </small>
                  <p>
                    {direct
                      ? "Lovely meeting you! Shall we find another table soon?"
                      : "Hi everyone! Looking forward to meeting you. Shall we meet outside five minutes before?"}
                  </p>
                </div>
              </div>
              {!direct &&
                current.members.includes("emma") &&
                speaker !== "emma" && (
                  <div className="chat-message">
                    <Avatar id="emma" size={30} />
                    <div>
                      <small>Emma</small>
                      <p>Sounds lovely! This is my first meal here. 😊</p>
                    </div>
                  </div>
                )}
              {(direct
                ? messages[directKey] || []
                : chatAccess === "read-only"
                  ? chatArchives[current.id] || messages[current.id] || []
                  : messages[current.id] || []
              ).map((text, i) => (
                <div className="chat-message own" key={i}>
                  <div>
                    <small>You</small>
                    <p>{text}</p>
                    <small>Sent</small>
                  </div>
                </div>
              ))}
              <ReviewOnly>
                <p className="demo-note">
                  Messages are simulated in this browser.
                </p>
              </ReviewOnly>
            </>
          )}
        </div>
      );
    }
    if (page === "create") {
      const venue = createVenues.find((v) => v.name === draft.venue)!;
      const slots = availableCreateSlots(
        draft.venue,
        draft.date,
        draft.capacity,
      );
      const updateSchedule = (patch: Partial<typeof draft>) => {
        const next = {
          ...draft,
          ...patch,
          externalConfirmed: false,
          accepted: false,
        };
        if (
          !availableCreateSlots(next.venue, next.date, next.capacity).includes(
            next.time,
          )
        )
          next.time = "";
        setDraft(next);
        setError("");
      };
      const nextStep = () => {
        keyboard.hide();
        const issue =
          createStep === 0
            ? validateArrangement(draft)
            : createStep === 1
              ? validateMeal(
                  draft.title,
                  draft.description,
                  draft.capacity,
                  draft.min,
                  draft.max,
                )
              : validateArrangement(
                  {
                    ...draft,
                    max: draft.cost === "menu" ? draft.min : draft.max,
                  },
                  "costs",
                );
        setError(issue);
        if (!issue) setCreateStep((s) => s + 1);
      };
      return (
        <div className="body-pad create-flow">
          <div
            className="create-progress"
            aria-label={`Step ${createStep + 1} of 4`}
          >
            {["Arrange", "Introduce", "Costs", "Review"].map((label, i) => (
              <button
                key={label}
                disabled={i > createStep}
                aria-current={i === createStep ? "step" : undefined}
                onClick={() => {
                  keyboard.hide();
                  setError("");
                  setCreateStep(i);
                }}
              >
                <span>{i < createStep ? <CheckIcon /> : i + 1}</span>
                {label}
              </button>
            ))}
          </div>
          <h1>
            {
              [
                "A place at your table.",
                "Good company starts here.",
                "Keep things clear.",
                "Ready to bring people together?",
              ][createStep]
            }
          </h1>
          <p className="prose">
            {
              [
                "Choose a restaurant, then find a time for your group.",
                "Give new faces a feel for your meal.",
                "Let everyone know what they’ll pay and who’s booking.",
                "Check the details your guests will see before you publish.",
              ][createStep]
            }
          </p>
          {createStep === 0 && (
            <>
              <VenueMap
                value={draft.venue}
                onConfirm={(v) =>
                  updateSchedule({ venue: v.name, min: v.min, max: v.max })
                }
              />
              <ChoiceGroup
                label="People, including you"
                value={String(draft.capacity)}
                onChange={(v) => updateSchedule({ capacity: Number(v) })}
                options={[2, 3, 4, 5, 6].map((n) => [String(n), `${n} people`])}
              />
              <p className="muted">
                {draft.capacity - 1} guest{draft.capacity === 2 ? "" : "s"} +
                you · Minimum {draft.capacity === 2 ? 2 : 3} confirmed people to
                go ahead, including you. Friendship-first at every table size.
              </p>
              <div className="create-calendar">
                <DateChoices
                  creation
                  value={draft.date}
                  meals={[]}
                  onChange={(date) => updateSchedule({ date, time: "" })}
                />
              </div>
              <ReviewOnly>
                <p className="muted">
                  London time · demo availability 17 Oct–15 Nov 2026. Mondays
                  are unavailable.
                </p>
              </ReviewOnly>
              {slots.length ? (
                <ChoiceGroup
                  label="Available times"
                  value={draft.time}
                  onChange={(time) => updateSchedule({ time })}
                  options={slots.map((t) => [t, t])}
                />
              ) : (
                <div className="summary-box" role="status">
                  <strong>No times for this selection</strong>
                  <p>
                    Choose another date or a smaller table. Your other details
                    are saved.
                  </p>
                </div>
              )}
              <ReviewOnly>
                <p className="demo-note">
                  Fictional restaurants and sample availability. A time
                  selection does not hold a table.
                </p>
              </ReviewOnly>
            </>
          )}
          {createStep === 1 && (
            <>
              <Field label="Give your meal a name">
                <KeyboardInput
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      title: e.target.value,
                      accepted: false,
                    })
                  }
                  onBlur={() => keyboard.hide()}
                  placeholder="e.g. Friday dinner & new faces"
                  maxLength={80}
                />
              </Field>
              <small className="muted">
                5–80 characters · {draft.title.length}/80
              </small>
              <Field label="What should people expect?">
                <KeyboardTextarea
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      description: e.target.value,
                      accepted: false,
                    })
                  }
                  onBlur={() => keyboard.hide()}
                  rows={4}
                  maxLength={1000}
                  placeholder="A relaxed dinner, a shared interest, or simply good company…"
                />
              </Field>
              <small className="muted">
                20–1,000 characters · {draft.description.length}/1,000
              </small>
              <ChoiceGroup
                label="Atmosphere"
                value={draft.mood}
                onChange={(mood) =>
                  setDraft({ ...draft, mood, accepted: false })
                }
                options={[
                  "Easy conversation",
                  "Food discoveries",
                  "Travel & culture",
                ].map((v) => [v, v])}
              />
              <ChoiceGroup
                label="Conversation language"
                value={draft.language}
                onChange={(language) =>
                  setDraft({ ...draft, language, accepted: false })
                }
                options={[
                  "English",
                  "Mandarin",
                  "English & Mandarin",
                  "English & French",
                ].map((v) => [v, v])}
              />
            </>
          )}
          {createStep === 2 && (
            <>
              <ChoiceGroup
                label="How guests pay"
                value={draft.cost}
                onChange={(cost) =>
                  setDraft({
                    ...draft,
                    cost,
                    max: Math.max(draft.min, draft.max),
                    accepted: false,
                  })
                }
                options={[
                  ["offline", "Pay at the restaurant"],
                  ["deposit", "Deposit in the app"],
                  ["menu", "Fixed menu in the app"],
                ]}
              />
              <p className="muted">
                {draft.cost === "offline"
                  ? "Everyone pays their own share. Nothing collected in the app."
                  : draft.cost === "deposit"
                    ? "The deposit is credited towards each guest’s bill. The balance is paid at the restaurant."
                    : "One fixed price per person. Drinks and service are extra, paid at the restaurant."}
              </p>
              <div className="form-grid">
                <Field
                  label={
                    draft.cost === "menu"
                      ? "Menu price per person (£)"
                      : "Budget from / person (£)"
                  }
                >
                  <KeyboardInput
                    type="number"
                    min={1}
                    step="0.01"
                    value={draft.min}
                    onBlur={() => keyboard.hide()}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        min: Number(e.target.value),
                        max:
                          draft.cost === "menu"
                            ? Number(e.target.value)
                            : draft.max,
                        accepted: false,
                      })
                    }
                  />
                </Field>
                {draft.cost !== "menu" && (
                  <Field label="Budget to / person (£)">
                    <KeyboardInput
                      type="number"
                      min={draft.min}
                      step="0.01"
                      value={draft.max}
                      onBlur={() => keyboard.hide()}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          max: Number(e.target.value),
                          accepted: false,
                        })
                      }
                    />
                  </Field>
                )}
              </div>
              {draft.cost === "deposit" && (
                <Field label="Deposit per person (£)">
                  <KeyboardInput
                    type="number"
                    min={0.01}
                    max={draft.min}
                    step="0.01"
                    value={draft.deposit}
                    onBlur={() => keyboard.hide()}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        deposit: Number(e.target.value),
                        accepted: false,
                      })
                    }
                  />
                </Field>
              )}
              <div className="cost-receipt">
                <span>
                  Each guest pays after approval
                  <strong>£{createDueNow(draft).toFixed(2)}</strong>
                </span>
                <span>
                  Collected when you publish<strong>£0.00</strong>
                </span>
                <small>
                  {draft.cost === "offline"
                    ? "Estimated spend is a guide, not a fixed charge."
                    : draft.cost === "menu"
                      ? "Menu paid in full; drinks and service are extra."
                      : "Balance paid at the restaurant."}
                </small>
              </div>
              <ChoiceGroup
                label="Restaurant reservation"
                value={draft.booking}
                onChange={(booking) =>
                  setDraft({
                    ...draft,
                    booking,
                    externalConfirmed: false,
                    accepted: false,
                  })
                }
                options={[
                  ["in-app", "Book through the app"],
                  ["external", "I’ve already booked"],
                ]}
              />
              {draft.booking === "in-app" ? (
                <div className="summary-box">
                  <strong>Reservation pending</strong>
                  <p>
                    Publish first, approve guests, then confirm the reservation
                    in Manage meal. Minimum {draft.capacity === 2 ? 2 : 3}{" "}
                    confirmed people; final party size uses confirmed guests,
                    including you.
                  </p>
                </div>
              ) : (
                <label className="create-consent">
                  <input
                    type="checkbox"
                    checked={draft.externalConfirmed}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        externalConfirmed: e.target.checked,
                        accepted: false,
                      })
                    }
                  />
                  <span>
                    I have a reservation at {draft.venue} for {draft.capacity}{" "}
                    people on {longDate(draft.date)} at {draft.time}. This is my
                    confirmation, not verification by the app.
                  </span>
                </label>
              )}
              <div className="summary-box">
                <strong>Cancellation terms</strong>
                <p>
                  {draft.cost === "offline"
                    ? "No in-app payment to refund. Let the host know if plans change."
                    : "Full refund until 24 hours before the meal; no refund after that. If the host cancels or the reservation fails, all payments are refunded."}
                </p>
                <ReviewOnly>
                  <small>Illustrative terms for this demo meal.</small>
                </ReviewOnly>
              </div>
            </>
          )}
          {createStep === 3 && (
            <>
              <div className="create-review">
                <div className="eyebrow">YOUR NEW TABLE</div>
                <h2>{draft.title}</h2>
                <p>{draft.description}</p>
                {[
                  [
                    "Place & time",
                    `${draft.venue} · ${venue.area}`,
                    `${longDate(draft.date)} · ${draft.time} London time · ${draft.capacity} people including you · Minimum ${draft.capacity === 2 ? 2 : 3} confirmed`,
                    0,
                  ],
                  ["The company", draft.mood, draft.language, 1],
                  [
                    "Costs & reservation",
                    draft.cost === "menu"
                      ? `£${draft.min} fixed menu per person`
                      : `£${draft.min}–${draft.max} estimated per person`,
                    `${draft.cost === "offline" ? "Pay at the restaurant" : `${money(createDueNow(draft))} after approval`} · ${draft.booking === "external" ? "Host reports already booked" : "Reservation pending"}`,
                    2,
                  ],
                ].map(([label, a, b, step]) => (
                  <section key={String(label)}>
                    <div>
                      <strong>{label}</strong>
                      <button
                        className="text-action"
                        onClick={() => {
                          setCreateStep(Number(step));
                          setDraft({ ...draft, accepted: false });
                        }}
                      >
                        Edit
                      </button>
                    </div>
                    <p>{a}</p>
                    <small>{b}</small>
                  </section>
                ))}
              </div>
              <div className="summary-box">
                <strong>Cancellation terms</strong>
                <p>
                  {draft.cost === "offline"
                    ? "No in-app payment to refund."
                    : "Full refund until 24 hours before the meal; no refund after that. Host cancellation or booking failure is refunded in full."}
                </p>
              </div>
              <ReviewOnly>
                <p className="demo-note">
                  Publishing invites applications. No real booking or charge is
                  made. Guests join only after your approval and any required
                  demo payment.
                </p>
              </ReviewOnly>
              <label className="create-consent">
                <input
                  type="checkbox"
                  checked={draft.accepted}
                  onChange={(e) =>
                    setDraft({ ...draft, accepted: e.target.checked })
                  }
                />
                <span>
                  I’ve checked the arrangements and the cancellation terms.
                </span>
              </label>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Primary onClick={createStep === 3 ? publish : nextStep}>
            {createStep === 3 ? "Publish meal" : "Continue"}
            <ArrowRightIcon />
          </Primary>
          {createStep > 0 && (
            <button
              className="text-action"
              onClick={() => {
                keyboard.hide();
                setError("");
                setCreateStep((s) => s - 1);
              }}
            >
              Previous step
            </button>
          )}
        </div>
      );
    }
    if (page === "meals")
      return (
        <div className="body-pad">
          <div className="eyebrow">GOOD PLANS, ALL IN ONE PLACE</div>
          <h1>Your next good meal.</h1>
          <Carousel
            ariaLabel="Meal categories"
            className="tab-carousel"
            contentClassName="tabs"
          >
            {["Upcoming", "Applications", "Hosting", "Past", "Cancelled"].map(
              (t) => (
                <button
                  className={mealTab === t ? "selected" : ""}
                  aria-pressed={mealTab === t}
                  onClick={() => setMealTab(t)}
                  key={t}
                >
                  {t}
                </button>
              ),
            )}
          </Carousel>
          {mealTab === "Past" ? (
            <>
              <div className="list-meal">
                <span className="eyebrow">THU 15 OCT · COMPLETED</span>
                <h2>A little supper club</h2>
                <p>Soho · You shared a table with Maya and Emma.</p>
                <div className="avatars">
                  <Avatar id="maya" />
                  <Avatar id="emma" />
                </div>
                <Primary
                  secondary
                  onClick={() => {
                    if (feedbackTarget.mealId !== "past-supper") {
                      setFeedbackTarget({
                        mealId: "past-supper",
                        title: "A little supper club",
                        date: "2026-10-15",
                        memberId: "maya",
                      });
                      setReview("");
                      setReviewed(false);
                      setWants(false);
                      setMutual(false);
                    }
                    go("review");
                  }}
                >
                  {reviewed && feedbackTarget.mealId === "past-supper"
                    ? "View your feedback"
                    : "Leave feedback"}
                </Primary>
              </div>
              <div className="list-meal">
                <span className="eyebrow">WED 14 OCT · HOSTED</span>
                <h2>A table I hosted</h2>
                <p>Soho · You hosted Maya and Emma.</p>
                <Primary
                  secondary
                  onClick={() => {
                    setFeedbackTarget({
                      mealId: "past-supper-host",
                      title: "A table I hosted",
                      date: "2026-10-14",
                      memberId: "maya",
                    });
                    setReview("");
                    setReviewed(false);
                    setWants(false);
                    setMutual(false);
                    go("review");
                  }}
                >
                  Record guest attendance
                </Primary>
              </div>
              <ReviewOnly>
                <p className="muted">
                  This completed meal is a fictional demo example.
                </p>
              </ReviewOnly>
            </>
          ) : (
            <>
              {meals
                .filter((m) =>
                  mealInCategory(m, states[m.id] || "NONE", mealTab),
                )
                .map((m) => (
                  <div className="list-meal" key={m.id}>
                    {mealCard(m, true)}
                    <div className="list-foot">
                      <span className="status-tag">
                        {m.owned
                          ? "You’re hosting"
                          : labels[states[m.id] || "NONE"]}
                      </span>
                    </div>
                  </div>
                ))}
              {!meals.some((m) =>
                mealInCategory(m, states[m.id] || "NONE", mealTab),
              ) && (
                <div className="empty">
                  <CalendarIcon />
                  <h2>
                    {mealTab === "Hosting"
                      ? "Your table starts with you."
                      : "A good meal is waiting."}
                  </h2>
                  <p>
                    {mealTab === "Applications"
                      ? "Your requests will appear here."
                      : "Find a table that fits your evening."}
                  </p>
                  <Primary
                    onClick={() =>
                      mealTab === "Hosting" ? go("create") : root("discover")
                    }
                  >
                    {mealTab === "Hosting" ? "Create a meal" : "Explore meals"}{" "}
                    <ArrowRightIcon />
                  </Primary>
                </div>
              )}
            </>
          )}
        </div>
      );
    if (page === "inbox") {
      const waiting = meals.filter((m) =>
        ["approval", "payment"].includes(
          inboxStage(m, states[m.id], confirmedChats[m.id]),
        ),
      );
      const chats = meals.filter(
        (m) =>
          groupChatAccess(
            m,
            states[m.id],
            confirmedChats[m.id],
            bookings[m.id] || m.booking,
          ) !== "locked",
      );
      const hasDirect = mutual && !blocked;
      return (
        <div className="body-pad inbox-page">
          <div className="eyebrow">BEFORE AND AFTER THE TABLE</div>
          <h1>
            {waiting.length ? "Your table is taking shape." : "A little hello."}
          </h1>
          {!!waiting.length && (
            <>
              <h2>
                Applications & next steps{" "}
                <span className="pill">{waiting.length}</span>
              </h2>
              <p className="muted">
                You’ve applied. Your group chat opens once your seat is
                confirmed.
              </p>
              {waiting.map((m) => {
                const pending =
                  inboxStage(m, states[m.id], confirmedChats[m.id]) ===
                  "approval";
                return (
                  <article
                    className="inbox-progress-card"
                    key={m.id}
                    aria-label={`Application for ${m.title}`}
                  >
                    <div className="inbox-application-heading">
                      <Avatar id={m.host} size={40} />
                      <div>
                        <h3>{m.title}</h3>
                        <small>
                          {longDate(m.date)} · {m.time} · {m.area}
                        </small>
                      </div>
                    </div>
                    <div
                      className="application-track"
                      aria-label={
                        pending
                          ? "Applied; awaiting host approval; then confirm your seat"
                          : "Host approved; payment required to confirm your seat"
                      }
                    >
                      <span className="done">
                        <CheckIcon />
                        Applied
                      </span>
                      <span className={pending ? "" : "done"}>
                        {pending ? <PersonIcon /> : <CheckIcon />}Host approval
                      </span>
                      <span>
                        <LockClosedIcon />
                        Group chat
                      </span>
                    </div>
                    <strong className="status-tag">
                      {pending
                        ? "Waiting for host approval"
                        : "Approved · payment needed"}
                    </strong>
                    <p>
                      {pending
                        ? `${members[m.host]?.name || "Your host"} will review your introduction. You haven’t joined the group yet.`
                        : `Pay £${m.deposit} to confirm your seat and unlock the meal group.`}
                    </p>
                    {pending ? (
                      <ReviewOnly>
                        <div className="demo-next-step">
                          <small>TRY THE NEXT STEP · DEMO ONLY</small>
                          <p>
                            No need to wait for a real host in this prototype.
                          </p>
                          <Primary secondary onClick={() => approveMeal(m)}>
                            Preview host approval
                          </Primary>
                        </div>
                      </ReviewOnly>
                    ) : (
                      <Primary
                        onClick={() => {
                          setSelected(m.id);
                          setConsent(false);
                          setScenarioPayment(false);
                          go("checkout");
                        }}
                      >
                        Pay £{m.deposit} & confirm <ArrowRightIcon />
                      </Primary>
                    )}
                    <button
                      className="text-action"
                      onClick={() => {
                        setSelected(m.id);
                        go("status");
                      }}
                    >
                      View application
                    </button>
                  </article>
                );
              })}
            </>
          )}
          {!!chats.length && (
            <>
              <h2>
                Your meal groups <span className="pill">{chats.length}</span>
              </h2>
              {chats.map((m) => (
                <button
                  className="inbox-row"
                  key={m.id}
                  onClick={() => {
                    setSelected(m.id);
                    go("chat");
                  }}
                >
                  <Avatar id={m.host} size={46} />
                  <div>
                    <strong>{m.title}</strong>
                    <p>
                      {conversationPreview(
                        m,
                        messages[m.id] || [],
                        preferences.messagePreviews,
                      )}
                    </p>
                    <small>
                      {longDate(m.date)} ·{" "}
                      {groupChatAccess(
                        m,
                        states[m.id],
                        confirmedChats[m.id],
                        bookings[m.id] || m.booking,
                      ) === "read-only"
                        ? "Archived · Read-only"
                        : "Seat confirmed · Meal group"}
                    </small>
                  </div>
                  <ArrowRightIcon />
                </button>
              ))}
            </>
          )}
          {hasDirect && (
            <>
              <h2>Personal conversations</h2>
              <button className="inbox-row" onClick={() => go("direct")}>
                <Avatar id={feedbackTarget.memberId} size={46} />
                <div>
                  <strong>{members[feedbackTarget.memberId].name}</strong>
                  <p>
                    {preferences.messagePreviews
                      ? "You both want to meet again."
                      : "Message previews are hidden"}
                  </p>
                </div>
                <HeartIcon />
              </button>
            </>
          )}
          {!waiting.length && !chats.length && !hasDirect && (
            <div className="empty">
              <ChatBubbleIcon />
              <h2>Your next hello starts here.</h2>
              <p>
                Apply to a meal to track your request here. Once your host
                approves and your seat is confirmed, your group chat will
                appear.
              </p>
              <Primary secondary onClick={() => root("discover")}>
                Find a meal
              </Primary>
            </div>
          )}
          {!!waiting.length && !chats.length && (
            <p className="inbox-locked-hint">
              <LockClosedIcon /> No open groups yet. Complete the next step
              above to join your table.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="notice">
            <LockClosedIcon />
            <span>
              No unsolicited private messages. Connect after a shared meal, when
              you both want to.
            </span>
          </div>
        </div>
      );
    }
    if (page === "settings")
      return (
        <div className="body-pad settings-page">
          <h1>Make yourself at home.</h1>
          <p className="prose">
            Your preferences, privacy and account in one place.
          </p>
          <section>
            <h2>Notifications & previews</h2>
            <label className="settings-toggle">
              <span>
                <strong>Meal update banners</strong>
                <small>
                  Show approval notifications. Your status always remains in
                  Inbox.
                </small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.mealUpdates}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    mealUpdates: e.target.checked,
                  })
                }
              />
            </label>
            <label className="settings-toggle">
              <span>
                <strong>Message previews</strong>
                <small>Show message text in your Inbox list.</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={preferences.messagePreviews}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    messagePreviews: e.target.checked,
                  })
                }
              />
            </label>
            <ReviewOnly>
              <p className="demo-note">
                Saved for this visit only. These controls don’t enable device
                push or email notifications.
              </p>
            </ReviewOnly>
          </section>
          <section>
            <h2>Privacy & safety</h2>
            <p>
              Your name, photo and introduction help your table get to know you.
              Your email is private.
            </p>
            <p>
              Meal groups require a confirmed seat. Private conversations
              require mutual choice after a shared meal.
            </p>
            <div className="settings-info-row">
              <span>Blocked members</span>
              <strong>
                {blockedMemberIds(blockedMembers).length
                  ? `${blockedMemberIds(blockedMembers).length} member${blockedMemberIds(blockedMembers).length === 1 ? "" : "s"}`
                  : "None"}
              </strong>
            </div>
            {blockedMemberIds(blockedMembers).map((id) => (
              <button
                key={id}
                className="text-action"
                onClick={() => {
                  setBlockedMembers((all) => ({ ...all, [id]: false }));
                  notify(
                    `${members[id].name} unblocked. Mutual connection rules still apply.`,
                  );
                }}
              >
                Unblock {members[id].name}
              </button>
            ))}
            <div className="settings-info-row">
              <span>App language</span>
              <strong>English</strong>
            </div>
            <small>
              Conversation languages can be changed in your profile.
            </small>
          </section>
          <section>
            <h2>Account</h2>
            <ReviewOnly>
              <p>Demo account · no real login credentials stored.</p>
            </ReviewOnly>
            <button
              className="settings-link"
              onClick={() => {
                setDraftProfile(profile);
                go("edit");
              }}
            >
              Edit public profile <ArrowRightIcon />
            </button>
            <button
              className="settings-link danger"
              onClick={() => {
                keyboard.hide();
                setSheet("signout");
              }}
            >
              Sign out <ArrowRightIcon />
            </button>
          </section>
          <ReviewOnly>
            <section className="demo-panel">
              <span>DEMO TOOLS</span>
              <p>
                All people, meals, payments and reservations are fictional.
                Changes reset on refresh.
              </p>
              <button
                className="settings-link"
                onClick={() => {
                  keyboard.hide();
                  setAfterAuth("discover");
                  setEntrance("splash");
                }}
              >
                Replay brand intro <ArrowRightIcon />
              </button>
              <small>
                Replaying the intro keeps your current demo session.
              </small>
              <button
                className="settings-link danger"
                onClick={() => {
                  keyboard.hide();
                  setSheet("reset");
                }}
              >
                Reset demo <ArrowRightIcon />
              </button>
            </section>
          </ReviewOnly>
        </div>
      );
    if (page === "profile")
      return (
        <div className="body-pad">
          <div className="profile-settings-entry">
            <button aria-label="Settings" onClick={() => go("settings")}>
              <GearIcon /> Settings
            </button>
          </div>
          <div className="profile-heading">
            <Avatar id="alex" size={82} />
            <h1>{profile.name}</h1>
            {profile.work && <p>{profile.work}</p>}
            <span className="pill">{profile.life}</span>
          </div>
          <Primary
            secondary
            onClick={() => {
              setDraftProfile(profile);
              go("edit");
            }}
          >
            Edit profile <PersonIcon />
          </Primary>
          <h2>A little about me</h2>
          <p className="prose">{profile.bio}</p>
          <h2>We could talk about</h2>
          <div className="tags">
            {profile.interests.split(",").map((t) => (
              <span key={t}>{t.trim()}</span>
            ))}
          </div>
          <h2>Languages</h2>
          <p>{profile.language}</p>
          {profile.hometown && (
            <>
              <h2>Hometown</h2>
              <p>{profile.hometown}</p>
            </>
          )}
          {profile.school && (
            <>
              <h2>School</h2>
              <p>{profile.school}</p>
            </>
          )}
          <h2>Your shared meals</h2>
          <p className="muted">
            No published references yet. Your first table is a good place to
            start.
          </p>
        </div>
      );
    if (page === "edit")
      return (
        <div className="body-pad">
          <h1>Let people meet you.</h1>
          <p className="prose">
            A little background makes the first hello easier.
          </p>
          {[
            ["name", "Your name"],
            ["bio", "About you"],
            ["life", "Your life in London"],
            ["language", "Conversation languages"],
            ["interests", "Interests, separated by commas"],
            ["work", "Work · optional"],
            ["school", "School · optional"],
            ["hometown", "Hometown · optional"],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              {key === "bio" ? (
                <KeyboardTextarea
                  value={draftProfile.bio}
                  maxLength={500}
                  rows={4}
                  onBlur={() => keyboard.hide()}
                  onChange={(e) =>
                    setDraftProfile({ ...draftProfile, bio: e.target.value })
                  }
                />
              ) : (
                <KeyboardInput
                  value={draftProfile[key as keyof typeof draftProfile]}
                  maxLength={key === "name" ? 40 : 150}
                  onBlur={() => keyboard.hide()}
                  onChange={(e) =>
                    setDraftProfile({ ...draftProfile, [key]: e.target.value })
                  }
                />
              )}
            </Field>
          ))}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Primary
            onClick={() => {
              if (
                draftProfile.name.trim().length < 2 ||
                draftProfile.bio.trim().length < 20 ||
                !draftProfile.language.trim() ||
                !draftProfile.life.trim() ||
                !draftProfile.interests.trim()
              ) {
                setError(
                  "Add your name (2+ characters), introduction (20+), London life, languages and interests.",
                );
                return;
              }
              setProfile(draftProfile);
              back();
              notify("Profile saved.");
            }}
          >
            Save profile <CheckIcon />
          </Primary>
        </div>
      );
    if (page === "review")
      return (
        <div className="body-pad">
          <div className="state-illustration">
            <HeartIcon />
          </div>
          <h1>
            {reviewed ? "Good company stays with you." : "How was your table?"}
          </h1>
          <p className="prose">
            A little feedback helps the next person feel welcome.
          </p>
          <div className="host-line">
            <Avatar id={feedbackTarget.memberId} size={46} />
            <div>
              <strong>{members[feedbackTarget.memberId].name}</strong>
              <p>
                {feedbackTarget.title} · {longDate(feedbackTarget.date)}
              </p>
            </div>
          </div>
          <section
            className="post-meal-panel"
            aria-label="Meal attendance and experience"
          >
            <h2>Record attendance</h2>
            <p className="muted">
              A confirmed seat is a place on the guest list. Tell us what
              happened after the meal. No location tracking is used.
            </p>
            <div className="post-meal-actions">
              {(["present", "absent"] as const).map((value) => (
                <button
                  type="button"
                  className={myAttendance === value ? "selected" : ""}
                  aria-pressed={myAttendance === value}
                  key={value}
                  onClick={() => {
                    try {
                      setAttendanceReports((rows) =>
                        reportAttendance(
                          rows,
                          postMealContext,
                          "alex",
                          "alex",
                          value,
                          new Date().toISOString(),
                        ),
                      );
                      setExperienceError("");
                      notify("Attendance recorded.");
                    } catch (e) {
                      setExperienceError((e as Error).message);
                    }
                  }}
                >
                  {value === "present" ? "I attended" : "I did not attend"}
                </button>
              ))}
            </div>
            {myAttendance === "conflict" && (
              <p role="status">
                Your report differs from the host’s. We keep both reports for
                review; this is not counted as a no-show.
              </p>
            )}
            {postMealContext.hostId === "alex" && (
              <div className="attendance-roster">
                <h3>Guest attendance</h3>
                {postMealContext.participantIds
                  .filter((id) => id !== "alex")
                  .map((id) => (
                    <div key={id}>
                      <span>
                        {members[id]?.name || id} ·{" "}
                        {attendanceResult(
                          attendanceReports,
                          postMealContext.id,
                          id,
                        )}
                      </span>
                      {(["present", "absent"] as const).map((value) => (
                        <button
                          key={value}
                          onClick={() => {
                            try {
                              setAttendanceReports((rows) =>
                                reportAttendance(
                                  rows,
                                  postMealContext,
                                  "alex",
                                  id,
                                  value,
                                  new Date().toISOString(),
                                ),
                              );
                              notify("Guest attendance recorded.");
                            } catch (e) {
                              setExperienceError((e as Error).message);
                            }
                          }}
                        >
                          {value === "present" ? "Attended" : "Did not attend"}
                        </button>
                      ))}
                    </div>
                  ))}
              </div>
            )}
            {myAttendance === "present" && (
              <>
                <h2>Your meal experience</h2>
                <p className="muted">
                  Private feedback about the whole meal, separate from public
                  references and reconnect choices. You can skip this section.
                </p>
                <fieldset className="experience-field">
                  <legend>Overall experience · 1 = poor, 5 = excellent</legend>
                  <div
                    className="post-meal-actions"
                    role="group"
                    aria-label="Overall meal experience"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        type="button"
                        key={value}
                        aria-label={`Rate ${value} out of 5`}
                        aria-pressed={experienceScore === String(value)}
                        onClick={() => setExperienceScore(String(value))}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="experience-field">
                  <legend>
                    What shaped your score? · optional, choose any
                  </legend>
                  <div className="experience-reasons">
                    {experienceReasons.map((code) => (
                      <label key={code}>
                        <input
                          type="checkbox"
                          checked={reasonChoices.includes(code)}
                          onChange={() =>
                            setReasonChoices((previous) =>
                              previous.includes(code)
                                ? previous.filter((v) => v !== code)
                                : [...previous, code],
                            )
                          }
                        />
                        {
                          {
                            company: "People at the table",
                            conversation: "Conversation",
                            coordination: "Organisation & timing",
                            expectations: "Match with expectations",
                            venue: "Restaurant & food",
                            cost: "Cost",
                            other: "Other",
                          }[code]
                        }
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="experience-field">
                  <legend>Would you join another Fancy meal?</legend>
                  <div className="post-meal-actions">
                    {[
                      ["true", "Yes"],
                      ["false", "No"],
                    ].map(([value, name]) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={experienceAgain === value}
                        onClick={() => setExperienceAgain(value)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <Primary
                  secondary
                  onClick={() => {
                    if (!experienceScore || !experienceAgain) {
                      setExperienceError(
                        "Choose a score and whether you would join another Fancy meal.",
                      );
                      return;
                    }
                    try {
                      setMealExperiences((rows) =>
                        saveExperience(
                          rows,
                          attendanceReports,
                          postMealContext,
                          "alex",
                          Number(experienceScore),
                          experienceAgain === "true",
                          reasonChoices,
                          new Date().toISOString(),
                        ),
                      );
                      setExperienceError("");
                      notify("Private meal experience saved.");
                    } catch (e) {
                      setExperienceError((e as Error).message);
                    }
                  }}
                >
                  {savedExperience
                    ? "Update meal experience"
                    : "Save meal experience"}
                </Primary>
                {savedExperience && (
                  <p role="status">
                    Meal experience saved · {savedExperience.score} / 5 ·{" "}
                    {savedExperience.reasons.length} reason(s)
                  </p>
                )}
              </>
            )}
            {experienceError && (
              <p className="form-error" role="alert">
                {experienceError}
              </p>
            )}
          </section>
          {!reviewed ? (
            <>
              <Field
                label="A public reference · optional"
                hint="Describe the shared experience, rather than rating a person."
              >
                <KeyboardTextarea
                  value={review}
                  maxLength={500}
                  onBlur={() => keyboard.hide()}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="What was it like sharing a table?"
                  rows={4}
                />
              </Field>
              <label className="check-row reconnect">
                <input
                  type="checkbox"
                  checked={wants}
                  disabled={myAttendance !== "present"}
                  onChange={(e) => setWants(e.target.checked)}
                />
                <span>
                  <strong>I’d like to share a table again</strong>
                  <small>Private unless you both choose this.</small>
                </span>
                <HeartIcon />
              </label>
              <p className="muted">
                {myAttendance !== "present" &&
                  "Record your attendance before leaving a reference. "}
                References appear after both people submit, or after 7 days.
                Private feedback is separate.
              </p>
              <Primary
                disabled={myAttendance !== "present"}
                onClick={() => {
                  setReviewed(true);
                  keyboard.hide();
                  notify(
                    "Feedback saved. Your reconnect choice stays private.",
                  );
                }}
              >
                Save feedback <CheckIcon />
              </Primary>
            </>
          ) : (
            <>
              <div className="summary-box">
                <strong>
                  {review
                    ? "Your reference is waiting to be published."
                    : "Your feedback is saved."}
                </strong>
                {review && <p>“{review}”</p>}
                <p>
                  {wants
                    ? "Your wish to meet again is private until mutual."
                    : "You haven’t asked to reconnect."}
                </p>
              </div>
              {wants && !mutual && (
                <ReviewOnly>
                  <div className="demo-panel">
                    <span>DEMO PREVIEW</span>
                    <p>
                      Explore what happens when{" "}
                      {members[feedbackTarget.memberId].name} also wants to meet
                      again.
                    </p>
                    <Primary
                      secondary
                      onClick={() => {
                        setMutual(true);
                        notify("Demo: you both want to share a table again.");
                      }}
                    >
                      Preview mutual connection <HeartIcon />
                    </Primary>
                  </div>
                </ReviewOnly>
              )}
              {mutual && (
                <>
                  <div className="notice">
                    <HeartIcon />
                    <span>
                      You and {members[feedbackTarget.memberId].name} both want
                      to meet again.
                    </span>
                  </div>
                  <Primary onClick={() => go("direct")}>
                    Say hello to {members[feedbackTarget.memberId].name}{" "}
                    <ChatBubbleIcon />
                  </Primary>
                </>
              )}
            </>
          )}
          <button className="text-action" onClick={() => setSheet("report")}>
            Share private feedback or report a concern
          </button>
        </div>
      );
    if (page === "host")
      return (
        <div className="body-pad">
          <h1>A few new faces.</h1>
          <p className="prose">
            Review each introduction before welcoming someone to your table.
          </p>
          <div className="summary-box">
            <strong>{current.title}</strong>
            <p>
              {current.confirmed} of {current.capacity} confirmed · You’re
              hosting · Minimum {current.capacity === 2 ? 2 : 3} including you
            </p>
          </div>
          <h2>Requests</h2>
          <div className="request-card">
            <div className="host-line">
              <Avatar id="emma" onClick={() => openMember("emma")} size={48} />
              <div>
                <strong>Emma</strong>
                <p>Researcher · New to London</p>
              </div>
            </div>
            <p className="prose">
              “I’d love to join! I’ve just moved here and a relaxed dinner
              sounds like a lovely way to meet people.”
            </p>
            {!hostDecision[current.id] ? (
              <div className="two-actions">
                <Primary
                  secondary
                  onClick={() => {
                    setHostDecision((s) => ({
                      ...s,
                      [current.id]: "Declined",
                    }));
                    notify("Request declined.");
                  }}
                >
                  Decline
                </Primary>
                <Primary
                  disabled={current.confirmed >= current.capacity}
                  onClick={() => {
                    setHostDecision((s) => ({
                      ...s,
                      [current.id]: current.deposit
                        ? "Approved · awaiting payment"
                        : "Confirmed",
                    }));
                    if (!current.deposit)
                      setMeals((ms) =>
                        ms.map((m) =>
                          m.id === current.id
                            ? addConfirmedMember(m, "emma")
                            : m,
                        ),
                      );
                    notify("Emma has been notified.");
                  }}
                >
                  Approve <CheckIcon />
                </Primary>
              </div>
            ) : (
              <>
                <span className="status-tag">{hostDecision[current.id]}</span>
                {hostDecision[current.id].startsWith("Approved") && (
                  <ReviewOnly>
                    <button
                      className="text-action"
                      onClick={() => {
                        setHostDecision((s) => ({
                          ...s,
                          [current.id]: "Confirmed",
                        }));
                        setMeals((ms) =>
                          ms.map((m) =>
                            m.id === current.id
                              ? addConfirmedMember(m, "emma")
                              : m,
                          ),
                        );
                        notify("Demo: Emma paid and confirmed her place.");
                      }}
                    >
                      Preview guest payment
                    </button>
                  </ReviewOnly>
                )}
              </>
            )}
          </div>
          <div className="notice">
            <InfoCircledIcon />
            <span>
              Pending requests don’t take a seat. Approved requests with payment
              due receive a temporary hold.
            </span>
          </div>
          <Primary secondary onClick={() => go("chat")}>
            Open meal group <ChatBubbleIcon />
          </Primary>
        </div>
      );
    return null;
  };
  const showComposer =
    (page === "chat" &&
      groupChatAccess(current, join, confirmedChats[current.id], booking) ===
        "write") ||
    (page === "direct" && mutual && !blocked);
  if (entrance)
    return (
      <BrandEntrance
        start={entrance}
        onBrowse={() => {
          keyboard.hide();
          setEntrance("");
          setPage("discover");
          setAfterAuth("discover");
        }}
        onComplete={(newProfile) => {
          keyboard.hide();
          if (newProfile) {
            setProfile(newProfile);
            setDraftProfile(newProfile);
          }
          setSignedIn(true);
          setEntrance("");
          setPage(afterAuth);
          setHistory([]);
          setError("");
        }}
      />
    );
  return (
    <SelfProfileContext.Provider
      value={{ image: profile.photo || "leo", name: profile.name }}
    >
      <div className="grab-app" data-review={REVIEW_MODE}>
        <ReviewOnly>
          <div className="demo-ribbon">
            INTERACTIVE DEMO · NO REAL BOOKINGS OR CHARGES
          </div>
        </ReviewOnly>
        {!topLevel && (
          <header className="page-header">
            <button onClick={back} aria-label="Go back">
              <ArrowLeftIcon />
            </button>
            <strong>{screenTitles[page]}</strong>
            <span />
          </header>
        )}
        {page === "discover" ? (
          renderPage()
        ) : (
          <MobileScroll
            key={page === "create" ? `create-${createStep}` : page}
            className={`page-scroll ${topLevel ? "with-tabs" : ""} ${showComposer ? "has-composer" : ""}`}
          >
            <main className={`page-content ${topLevel ? "top-level" : ""}`}>
              {renderPage()}
            </main>
          </MobileScroll>
        )}
        {showComposer && (
          <div className="composer" style={{ bottom: insets.bottomInset }}>
            <KeyboardInput
              aria-label="Message"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onBlur={() => keyboard.hide()}
              placeholder="Say a little hello…"
              maxLength={2000}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.nativeEvent.isComposing &&
                  chatText.trim()
                ) {
                  const key = page === "direct" ? directKey : current.id;
                  setMessages((ms) => ({
                    ...ms,
                    [key]: [...(ms[key] || []), chatText.trim()],
                  }));
                  setChatText("");
                  keyboard.hide();
                }
              }}
            />
            <button
              aria-label="Send message"
              onPointerDown={(e) => e.preventDefault()}
              disabled={!chatText.trim()}
              onClick={() => {
                const key = page === "direct" ? directKey : current.id;
                setMessages((ms) => ({
                  ...ms,
                  [key]: [...(ms[key] || []), chatText.trim()],
                }));
                setChatText("");
                keyboard.hide();
              }}
            >
              <PaperPlaneIcon />
            </button>
          </div>
        )}
        {topLevel && (
          <nav className="bottom-nav" aria-label="Main navigation">
            <button
              className={page === "discover" ? "active" : ""}
              onClick={() => root("discover")}
            >
              <MagnifyingGlassIcon />
              <span>Discover</span>
            </button>
            <button
              className={page === "meals" ? "active" : ""}
              onClick={() => root("meals")}
            >
              <PersonIcon />
              <span>Meals</span>
            </button>
            <button className="create-nav" onClick={() => go("create")}>
              <span className="create-circle">
                <PlusIcon />
              </span>
              <span>Create meal</span>
            </button>
            <button
              className={page === "inbox" ? "active" : ""}
              onClick={() => root("inbox")}
            >
              <ChatBubbleIcon />
              <span>Inbox</span>
            </button>
            <button
              className={page === "profile" ? "active" : ""}
              onClick={() => root("profile")}
            >
              <PersonIcon />
              <span>Profile</span>
            </button>
          </nav>
        )}
        <MealHelper
          meals={meals.map((meal) => ({
            ...meal,
            booking: bookings[meal.id] || meal.booking,
          }))}
          current={
            [
              "detail",
              "apply",
              "status",
              "checkout",
              "booking",
              "chat",
              "host",
            ].includes(page)
              ? { ...current, booking }
              : undefined
          }
          filters={filters}
          page={page}
          visible={!sheet}
          onMeal={(id) => {
            setSelected(id);
            go("detail");
          }}
          onAction={(action, query) => {
            if (action.kind === "create") {
              const venue =
                createVenues.find((v) => v.area === query.area) ||
                createVenues[0];
              const capacity =
                Number(query.size) >= 2 && Number(query.size) <= 6
                  ? Number(query.size)
                  : 4;
              const date = query.date || initialDraft.date;
              setDraft({
                ...initialDraft,
                venue: venue.name,
                date,
                capacity,
                time: "",
                title: "A meal with new faces",
                description: action.text,
                min: venue.min,
                max: venue.max,
                language: query.language || "English",
                mood: query.mood || "Easy conversation",
                cost: "offline",
                deposit: 0,
                accepted: false,
                externalConfirmed: false,
              });
              setCreateStep(0);
              setReviewed(false);
              go("create");
            } else {
              const meal = meals.find((m) => m.id === action.mealId);
              if (!meal) {
                notify("This meal is no longer available.");
                return;
              }
              setSelected(meal.id);
              if (action.kind === "application") {
                const membership = states[meal.id] || "NONE";
                if (meal.owned) {
                  go("host");
                  notify(
                    "You host this meal. Review your guests in Manage applications.",
                  );
                } else if (
                  membership !== "NONE" &&
                  membership !== "WITHDRAWN"
                ) {
                  go("status");
                  notify(
                    "You already have an application or membership for this meal.",
                  );
                } else if (
                  meal.confirmed >= meal.capacity ||
                  (bookings[meal.id] || meal.booking) === "CANCELLED"
                ) {
                  go("detail");
                  notify("This meal isn’t accepting applications.");
                } else {
                  setIntro(action.text);
                  go("apply");
                }
              } else if (
                groupChatAccess(
                  meal,
                  states[meal.id] || "NONE",
                  confirmedChats[meal.id],
                  bookings[meal.id] || meal.booking,
                ) === "write"
              ) {
                setChatText(action.text);
                go("chat");
              } else {
                go("detail");
                notify(
                  "Only confirmed participants can send to the meal group.",
                );
              }
            }
          }}
        />
        {toast && (
          <div
            className="toast"
            role="status"
            style={{ bottom: Math.max(125, insets.bottomInset + 75) }}
          >
            <CheckCircledIcon />
            {toast}
          </div>
        )}
        <BottomSheet
          open={sheet === "date" || sheet === "size" || sheet === "filters"}
          onOpenChange={(o) => !o && setSheet("")}
          title={
            sheet === "date"
              ? "When are you free?"
              : sheet === "size"
                ? "Your kind of table"
                : "Make it your kind of meal"
          }
          description={
            sheet === "filters" ? "A few preferences, a better table." : ""
          }
          snap={sheet === "size" ? 0.55 : 0.88}
        >
          <div className="filter-layout">
            <div className="filter-topline">
              <span>
                {sheet === "date"
                  ? "CHOOSE A DAY"
                  : sheet === "size"
                    ? "INCLUDING THE HOST"
                    : "YOUR PREFERENCES"}
              </span>
              <button
                aria-label="Close filters without applying"
                onClick={() => {
                  keyboard.hide();
                  setSheet("");
                }}
              >
                <Cross2Icon />
              </button>
            </div>
            <div className="filter-scroll">
              {(sheet === "size" || sheet === "filters") && (
                <ChoiceGroup
                  label="Table size"
                  value={pendingFilters.size}
                  onChange={(size) =>
                    setPendingFilters({ ...pendingFilters, size })
                  }
                  options={[
                    ["", "Any size"],
                    ["small", "3–6 people"],
                    ["2", "2 people"],
                    ["3", "3 people"],
                    ["4", "4 people"],
                    ["5", "5 people"],
                    ["6", "6 people"],
                  ]}
                />
              )}
              {sheet === "date" && (
                <DateChoices
                  value={pendingFilters.date}
                  onChange={(date) =>
                    setPendingFilters({ ...pendingFilters, date })
                  }
                  meals={meals}
                />
              )}
              {sheet === "filters" && (
                <>
                  <section className="filter-section">
                    <h3>Date</h3>
                    <button
                      className="date-disclosure"
                      aria-expanded={showCalendar}
                      onClick={() => setShowCalendar((v) => !v)}
                    >
                      <CalendarIcon />
                      <span>
                        {pendingFilters.date
                          ? longDate(pendingFilters.date)
                          : "Any date"}
                        <small>Choose a specific day</small>
                      </span>
                      <ChevronDownIcon />
                    </button>
                    {showCalendar && (
                      <DateChoices
                        value={pendingFilters.date}
                        onChange={(date) =>
                          setPendingFilters({ ...pendingFilters, date })
                        }
                        meals={meals}
                      />
                    )}
                  </section>
                  <ChoiceGroup
                    label="Time of day"
                    value={pendingFilters.time}
                    onChange={(time) =>
                      setPendingFilters({ ...pendingFilters, time })
                    }
                    options={[
                      ["", "Any time"],
                      ["lunch", "Lunch"],
                      ["dinner", "Dinner"],
                    ]}
                  />
                  <ChoiceGroup
                    label="Neighbourhood"
                    value={pendingFilters.area}
                    onChange={(area) =>
                      setPendingFilters({ ...pendingFilters, area })
                    }
                    options={[
                      ["", "Anywhere"],
                      ...Array.from(new Set(meals.map((m) => m.area))).map(
                        (a) => [a, a] as [string, string],
                      ),
                    ]}
                  />
                  <ChoiceGroup
                    label="Budget per person"
                    value={pendingFilters.budget}
                    onChange={(budget) =>
                      setPendingFilters({ ...pendingFilters, budget })
                    }
                    options={[
                      ["", "Any budget"],
                      ["10", "Up to £10"],
                      ["25", "Up to £25"],
                      ["30", "Up to £30"],
                      ["35", "Up to £35"],
                      ["50", "Up to £50"],
                    ]}
                  />
                  <ChoiceGroup
                    label="Conversation language"
                    value={pendingFilters.language}
                    onChange={(language) =>
                      setPendingFilters({ ...pendingFilters, language })
                    }
                    options={[
                      ["", "Any language"],
                      ["English", "English"],
                      ["Mandarin", "Mandarin"],
                      ["French", "French"],
                    ]}
                  />
                  <ChoiceGroup
                    label="Atmosphere"
                    value={pendingFilters.mood}
                    onChange={(mood) =>
                      setPendingFilters({ ...pendingFilters, mood })
                    }
                    options={[
                      ["", "Any atmosphere"],
                      ["Easy conversation", "Easy conversation"],
                      ["Food discoveries", "Food discoveries"],
                      ["Travel & culture", "Travel & culture"],
                    ]}
                  />
                  <ChoiceGroup
                    label="Cuisine"
                    value={pendingFilters.cuisine}
                    onChange={(cuisine) =>
                      setPendingFilters({ ...pendingFilters, cuisine })
                    }
                    options={[
                      ["", "Any cuisine"],
                      ["European", "European"],
                      ["Japanese", "Japanese"],
                      ["Spanish", "Spanish"],
                    ]}
                  />
                  <ChoiceGroup
                    label="Dietary options"
                    value={pendingFilters.dietary}
                    onChange={(dietary) =>
                      setPendingFilters({ ...pendingFilters, dietary })
                    }
                    options={[
                      ["", "No preference"],
                      ["Vegetarian options", "Vegetarian options"],
                    ]}
                  />
                  <Field label="Restaurant or keyword">
                    <KeyboardInput
                      placeholder="Search meals or restaurants"
                      value={pendingFilters.search}
                      onBlur={() => keyboard.hide()}
                      onChange={(e) =>
                        setPendingFilters({
                          ...pendingFilters,
                          search: e.target.value,
                        })
                      }
                    />
                  </Field>
                </>
              )}
            </div>
            <div className="filter-footer">
              <button
                className="filter-clear"
                onClick={() =>
                  setPendingFilters(
                    sheet === "date"
                      ? { ...pendingFilters, date: "" }
                      : sheet === "size"
                        ? { ...pendingFilters, size: "" }
                        : { ...emptyFilters },
                  )
                }
              >
                {sheet === "filters" ? "Clear all" : "Clear"}
              </button>
              <Primary onClick={applyFilters}>
                {sheet === "filters"
                  ? `Show ${pendingMatches.length} ${pendingMatches.length === 1 ? "meal" : "meals"}`
                  : sheet === "date"
                    ? "Apply date"
                    : "Apply table size"}{" "}
                <ArrowRightIcon />
              </Primary>
            </div>
          </div>
        </BottomSheet>
        <BottomSheet
          open={sheet === "area"}
          onOpenChange={(o) => !o && setSheet("")}
          title={`${areaGroup?.area || "Area"} tables`}
          description={`${areaMeals.length} ${areaMeals.length === 1 ? "meal matches" : "meals match"} your filters`}
          snap={0.85}
        >
          <div className="area-sheet-list">
            {areaMeals.map((m) => (
              <div className="list-meal" key={m.id}>
                {mealCard(m, true)}
              </div>
            ))}
            <ReviewOnly>
              <p className="demo-note">
                Choose a meal to see the restaurant, people and details.
              </p>
            </ReviewOnly>
          </div>
        </BottomSheet>
        <BottomSheet
          open={sheet === "cancel"}
          onOpenChange={(o) => !o && setSheet("")}
          title="Cancel your place?"
          snap={0.65}
        >
          <div className="sheet-body">
            <p className="prose">
              Your seat at <strong>{current.title}</strong> will be released.
              The group chat becomes read-only.
            </p>
            <div className="summary-box">
              <div className="price-row">
                <span>Paid</span>
                <strong>
                  {payment === "PAID" ? money(current.deposit) : "£0"}
                </strong>
              </div>
              <div className="price-row total">
                <span>Eligible refund</span>
                <strong>
                  {payment === "PAID"
                    ? money(
                        refundAmount(
                          current.deposit,
                          beforeDeadline,
                          platformCancel,
                        ),
                      )
                    : "£0"}
                </strong>
              </div>
              <p>
                {platformCancel
                  ? "The reservation failed. Your payment is refunded in full."
                  : beforeDeadline
                    ? "Before this meal’s cancellation deadline."
                    : "After this meal’s cancellation deadline; no deposit refund."}
              </p>
            </div>
            <ReviewOnly>
              <label className="check-row demo-option">
                <input
                  type="checkbox"
                  checked={!beforeDeadline}
                  onChange={(e) => setBeforeDeadline(!e.target.checked)}
                />
                <span>Demo: preview after the deadline</span>
              </label>
            </ReviewOnly>
            <Primary secondary onClick={() => setSheet("")}>
              Keep my place
            </Primary>
            <button className="cancel-confirm" onClick={cancelParticipation}>
              Confirm cancellation
            </button>
          </div>
        </BottomSheet>
        <BottomSheet
          open={sheet === "scenarios"}
          onOpenChange={(o) => !o && setSheet("")}
          title="Explore demo outcomes"
          snap={0.75}
        >
          <div className="sheet-body">
            <p className="muted">
              These controls simulate provider and host actions. No external
              service is contacted.
            </p>
            <Primary
              secondary
              onClick={() => {
                setBookings((b) => ({ ...b, [current.id]: "PENDING" }));
                setSheet("");
              }}
            >
              Reservation pending
            </Primary>
            <Primary
              secondary
              onClick={() => {
                setBookings((b) => ({ ...b, [current.id]: "FAILED" }));
                setPlatformCancel(true);
                setSheet("");
              }}
            >
              Reservation fails
            </Primary>
            <Primary
              secondary
              onClick={() => {
                setBookings((b) => ({ ...b, [current.id]: "CONFIRMED" }));
                setSheet("");
              }}
            >
              Reservation confirmed
            </Primary>
            {refunds[current.id] && (
              <>
                <Primary
                  secondary
                  onClick={() => {
                    setRefunds((r) => ({ ...r, [current.id]: "REFUNDED" }));
                    setSheet("");
                  }}
                >
                  Refund completes
                </Primary>
                <Primary
                  secondary
                  onClick={() => {
                    setRefunds((r) => ({ ...r, [current.id]: "FAILED" }));
                    setSheet("");
                  }}
                >
                  Refund needs attention
                </Primary>
              </>
            )}
            {(join === "CONFIRMED" || current.owned) && (
              <Primary
                secondary
                onClick={() => {
                  setCompleted((all) => ({ ...all, [current.id]: true }));
                  setFeedbackTarget({
                    mealId: current.id,
                    title: current.title,
                    date: current.date,
                    memberId:
                      current.host === "alex"
                        ? current.members.find((id) => id !== "alex") || "maya"
                        : current.host,
                  });
                  setReview("");
                  setReviewed(false);
                  setWants(false);
                  setMutual(false);
                  go("review");
                }}
              >
                Advance to post-meal feedback
              </Primary>
            )}
          </div>
        </BottomSheet>
        <BottomSheet
          open={sheet === "report"}
          onOpenChange={(o) => !o && setSheet("")}
          title={`Share a private concern about ${members[reportMemberId].name}`}
          snap={0.65}
        >
          <div className="sheet-body">
            <p className="muted">
              Private feedback is separate from public references.
            </p>
            <Field label="What would you like us to know?">
              <KeyboardTextarea
                rows={4}
                maxLength={1000}
                value={report}
                onBlur={() => keyboard.hide()}
                onChange={(e) => setReport(e.target.value)}
              />
            </Field>
            <Primary
              disabled={!report.trim()}
              onClick={() => {
                keyboard.hide();
                setSheet("");
                setReport("");
                notify("Report submitted.");
              }}
            >
              Submit report
            </Primary>
            <button
              className="text-action danger"
              onClick={() => {
                setBlockedMembers((all) => ({
                  ...all,
                  [reportMemberId]: true,
                }));
                setSheet("");
                notify("Member blocked.");
              }}
            >
              Block {members[reportMemberId].name}
            </button>
          </div>
        </BottomSheet>
        <BottomSheet
          open={sheet === "signout"}
          onOpenChange={(open) => !open && setSheet("")}
          title="Sign out?"
          snap={0.4}
        >
          <div className="sheet-body">
            <p>You’ll return to the account screen.</p>
            <Primary secondary onClick={() => setSheet("")}>
              Stay signed in
            </Primary>
            <button
              className="cancel-confirm"
              onClick={() => {
                keyboard.hide();
                setSheet("");
                setSignedIn(false);
                setAfterAuth("discover");
                setHistory([]);
                setPage("discover");
                setEntrance("account");
              }}
            >
              Sign out
            </button>
          </div>
        </BottomSheet>
        <BottomSheet
          open={sheet === "reset"}
          onOpenChange={(o) => !o && setSheet("")}
          title="Start again?"
          snap={0.4}
        >
          <div className="sheet-body">
            <p>
              Demo applications, messages, created meals and profile edits will
              be cleared.
            </p>
            <Primary secondary onClick={() => setSheet("")}>
              Keep exploring
            </Primary>
            <button
              className="cancel-confirm"
              onClick={() => {
                setMeals(initialMeals);
                setStates({});
                setConfirmedChats({});
                setChatArchives({});
                setPayments({});
                setBookings({});
                setReservedSizes({});
                setRefunds({});
                setRefundValues({});
                setFeedbackTarget({
                  mealId: "past-supper",
                  title: "A little supper club",
                  date: "2026-10-15",
                  memberId: "maya",
                });
                setMessages({});
                setPreferences({ mealUpdates: true, messagePreviews: true });
                setReviewed(false);
                setMutual(false);
                setWants(false);
                setReview("");
                setBlockedMembers({});
                setHostDecision({});
                setDraft(initialDraft);
                setChatText("");
                setIntro(
                  "I’m new to London and would love to meet people over a relaxed meal.",
                );
                setScenarioPayment(false);
                setCompleted({});
                setConsent(false);
                setBeforeDeadline(true);
                setPlatformCancel(false);
                setMode("map");
                setProfile({
                  name: "Alex",
                  bio: members.alex.bio,
                  life: "New to London",
                  language: "English",
                  interests: "Food, photography, travel",
                  work: "Creative strategist",
                  school: "",
                  hometown: "",
                });
                setFilters({ ...emptyFilters });
                setSelected("supper");
                setSelectedArea("Soho");
                setCreateStep(0);
                root("discover");
                notify("Demo reset. A fresh table awaits.");
              }}
            >
              Reset demo
            </button>
          </div>
        </BottomSheet>
      </div>
    </SelfProfileContext.Provider>
  );
}

/** R1 uses the same phone runtime, brand entrance, map, fields and helper as the future exploration. */
function PilotPrototype() {
  const keyboard = useKeyboard();
  const { screenRef } = useScreenPortal();
  useEffect(() => {
    const screen = screenRef.current;
    if (!screen) return;
    const anchor = () => {
      if (screen.scrollTop || screen.scrollLeft)
        screen.scrollTo({ top: 0, left: 0 });
    };
    anchor();
    screen.addEventListener("scroll", anchor);
    return () => screen.removeEventListener("scroll", anchor);
  }, [screenRef]);
  const [state, setState] = useState(pilotSeed);
  const [actor, setActor] = useState("alex");
  const [signed, setSigned] = useState(false);
  const [entrance, setEntrance] = useState<"splash" | "account" | "">("splash");
  const [page, setPage] = useState("discover");
  const [selected, setSelected] = useState("supper");
  const [target, setTarget] = useState("maya");
  const [issue, setIssue] = useState("");
  const [notice, setNotice] = useState("");
  const [text, setText] = useState("");
  const [sheet, setSheet] = useState("");
  const [step, setStep] = useState(0);
  const [map, setMap] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState({
    date: "",
    size: "",
    budget: "",
    language: "",
  });
  const [pending, setPending] = useState(filter);
  const [areaIds, setAreaIds] = useState<string[] | null>(null);
  const [settingsByUser, setSettingsByUser] = useState<
    Record<string, { consent: boolean; updates: boolean }>
  >({});
  const consent = settingsByUser[actor]?.consent ?? false;
  const updates = settingsByUser[actor]?.updates ?? true;
  const setConsent = (value: boolean) =>
    setSettingsByUser((all) => ({
      ...all,
      [actor]: { consent: value, updates },
    }));
  const setUpdates = (value: boolean) =>
    setSettingsByUser((all) => ({
      ...all,
      [actor]: { consent, updates: value },
    }));
  const [connection, setConnection] = useState("online");
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    venue: "",
    address: "",
    area: "",
    date: "2026-10-25",
    time: "19:00",
    capacity: "4",
    budgetMin: "25",
    budgetMax: "35",
    language: "en",
    instant: "",
    replacementFor: "",
  });
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [feedbackReasons, setFeedbackReasons] = useState<string[]>([]);
  const [score, setScore] = useState("");
  const [again, setAgain] = useState("");
  const [reason, setReason] = useState("");
  const [clock, setClock] = useState(state.now.slice(0, 16));
  const [deletion, setDeletion] = useState("");
  const [reauth, setReauth] = useState(false);
  const self = state.users.find((u) => u.id === actor)!;
  const meal = state.meals.find((m) => m.id === selected) || state.meals[0];
  useEffect(() => {
    if (page === "review") {
      const saved = state.feedback.find(
        (f) => f.mealId === selected && f.userId === actor,
      );
      setScore(saved ? String(saved.score) : "");
      setAgain(saved ? (saved.again ? "yes" : "no") : "");
      setFeedbackReasons(saved?.reasons || []);
    }
  }, [page, selected, actor]);
  const app = [...state.applications]
    .reverse()
    .find((a) => a.mealId === selected && a.userId === actor);
  const count = confirmedIds(state, selected).length;
  const access = groupAccess(state, selected, actor);
  const host = meal.hostId === actor;
  const local = (at: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(at));
  const go = (next: string) => {
    keyboard.hide();
    setPage(next);
    setIssue("");
    setNotice("");
    setText("");
  };
  const open = (id: string) => {
    if (!state.meals.some((m) => m.id === id)) {
      setIssue("This meal is unavailable. Choose another table.");
      return;
    }
    setSelected(id);
    go("detail");
  };
  const auth = (next: string) => {
    if (signed) {
      go(next);
      return;
    }
    setPage(next);
    keyboard.hide();
    setEntrance("account");
  };
  const run = (command: Omit<Command, "key">, success?: string) => {
    keyboard.hide();
    setIssue("");
    setNotice("");
    if (!signed) {
      setEntrance("account");
      return false;
    }
    if (connection !== "online") {
      setIssue(
        connection === "offline"
          ? "You’re offline. Your input is saved; reconnect and retry."
          : "The service is unavailable. Your input is saved; retry shortly.",
      );
      return false;
    }
    const current = advanceLifecycle(state, state.now);
    try {
      const next = act(
        current,
        actor,
        { ...command, key: crypto.randomUUID() } as Command,
        current.now,
        current.version,
      );
      setState(next);
      if (success) setNotice(success);
      return next;
    } catch (error) {
      setState(current);
      setIssue(error instanceof Error ? error.message : "Please retry.");
      return false;
    }
  };
  const download = (data: unknown, name: string) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const allMatches = state.meals.filter(
    (m) =>
      m.status === "OPEN" &&
      Date.parse(m.startsAt) > Date.parse(state.now) &&
      (!filter.date ||
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/London",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(m.startsAt)) === filter.date) &&
      (!filter.size || m.capacity === Number(filter.size)) &&
      (!filter.budget || m.budgetMax <= Number(filter.budget) * 100) &&
      (!filter.language || m.languages.includes(filter.language)) &&
      (!query ||
        `${m.title} ${m.area} ${m.venue}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const browse = allMatches.filter((m) => !areaIds || areaIds.includes(m.id));
  const mapGroups = [...new Set(allMatches.map((m) => m.area))].flatMap(
    (area) => {
      const point = initialMeals.find((m) => m.area === area);
      return point
        ? [
            {
              id: area,
              label: `${area}: ${allMatches.filter((m) => m.area === area).length} meals`,
              text: String(allMatches.filter((m) => m.area === area).length),
              x: point.x,
              y: point.y,
            },
          ]
        : [];
    },
  );
  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: { type?: string; maxLength?: number; area?: boolean } = {},
  ) => (
    <Field label={label}>
      {options.area ? (
        <KeyboardTextarea
          rows={3}
          value={value}
          maxLength={options.maxLength}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => keyboard.hide()}
        />
      ) : (
        <KeyboardInput
          type={options.type || "text"}
          value={value}
          maxLength={options.maxLength}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => keyboard.hide()}
        />
      )}
    </Field>
  );
  const choose = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: string[],
  ) => (
    <ChoiceGroup
      label={label}
      value={value}
      onChange={onChange}
      options={options.map((v) => [v, v || "Any"])}
    />
  );
  const avatar = (id: string) => (
    <button
      className="r1-avatar"
      key={id}
      aria-label={`View ${state.users.find((u) => u.id === id)?.name || "member"}`}
      onClick={(e) => {
        e.stopPropagation();
        setTarget(id);
        auth("member");
      }}
    >
      <img
        alt=""
        src={`/images/${["maya", "leo", "emma"].includes(id) ? id : "leo"}.png`}
      />
    </button>
  );
  const card = (m: PilotMeal) => (
    <article key={m.id} className="r1-card">
      <button
        className="r1-card-open"
        aria-label={`Open ${m.title}`}
        onClick={() => open(m.id)}
      />
      <div className="r1-card-top">
        <img
          className="r1-food"
          src="/images/restaurant.png"
          onError={(e) => {
            e.currentTarget.src = "/images/brand-table.png";
          }}
          alt="A table for sharing a meal"
        />
        <div>
          <h3>{m.title}</h3>
          <p>{m.venue}</p>
          <small>{m.area} · London</small>
        </div>
      </div>
      <p className="r1-meta">
        {local(m.startsAt)}
        <br />
        {money(m.budgetMin / 100)}–{money(m.budgetMax / 100)} per person · Pay
        at restaurant
      </p>
      <div className="r1-people">
        {confirmedIds(state, m.id).map(avatar)}
        <span>
          {confirmedIds(state, m.id).length} of {m.capacity} confirmed
        </span>
      </div>
    </article>
  );
  const authProfile = (profile?: WelcomeProfile) => {
    if (profile) {
      try {
        setState((s) =>
          act(
            s,
            "alex",
            {
              type: "profile",
              key: crypto.randomUUID(),
              name: profile.name,
              bio: profile.bio,
              languages: profile.language.includes("Mandarin")
                ? ["en", "zh"]
                : profile.language.includes("French")
                  ? ["en", "fr"]
                  : ["en"],
              interests: [profile.interests],
            },
            s.now,
          ),
        );
      } catch (e) {
        setIssue(String(e));
        return;
      }
    }
    setSigned(true);
    setEntrance("");
  };
  if (entrance)
    return (
      <BrandEntrance
        start={entrance}
        onBrowse={() => {
          setEntrance("");
          go("discover");
        }}
        onComplete={authProfile}
      />
    );
  const member = projectMember(state, signed ? actor : null, target);
  const editingWindow =
    Date.parse(state.now) >= Date.parse(meal.scheduledEndAt) &&
    Date.parse(state.now) < Date.parse(meal.scheduledEndAt) + 7 * DAY &&
    eligibleAtMeal(state, meal.id, actor);
  const result = attendanceStatus(state, selected, actor);
  const groups = state.meals.filter(
    (m) =>
      m.hostId === actor ||
      state.applications.some((a) => a.mealId === m.id && a.userId === actor),
  );
  const navItems = [
    ["discover", "Discover", <MagnifyingGlassIcon />],
    ["meals", "Meals", <PersonIcon />],
    ["create", "Create meal", <PlusIcon />],
    ["inbox", "Inbox", <ChatBubbleIcon />],
    ["profile", "Profile", <PersonIcon />],
  ] as const;
  return (
    <SelfProfileContext.Provider value={{ image: "leo", name: self.name }}>
      <div
        className="grab-app r1-app"
        data-review={REVIEW_MODE}
        data-scope="r1"
      >
        <header className="r1-header">
          <button
            aria-label="Back"
            onClick={() =>
              go(
                ["chat", "host", "apply", "review", "member"].includes(page)
                  ? "detail"
                  : "discover",
              )
            }
          >
            <ArrowLeftIcon />
          </button>
          <strong>{BRAND.name}</strong>
          <button aria-label="Settings" onClick={() => auth("settings")}>
            <GearIcon />
          </button>
        </header>
        <MobileScroll key={`${page}-${selected}`} className="r1-scroll">
          <main className="body-pad r1-content">
            {issue && (
              <div className="form-error" role="alert">
                {issue}
              </div>
            )}
            {notice && (
              <div className="r1-notice" role="status">
                {notice}
              </div>
            )}
            {page === "discover" && (
              <>
                <div className="eyebrow">LONDON · GOOD COMPANY AWAITS</div>
                <h1>{BRAND.invitation}</h1>
                <p className="muted">{BRAND.slogan}</p>
                {field("Find a table or neighbourhood", query, setQuery)}
                <div className="r1-toolbar">
                  <button
                    onClick={() => {
                      setPending(filter);
                      keyboard.hide();
                      setSheet("date");
                    }}
                  >
                    <CalendarIcon />
                    {filter.date || "Any date"}
                  </button>
                  <button
                    onClick={() => {
                      setPending(filter);
                      keyboard.hide();
                      setSheet("size");
                    }}
                  >
                    Table size {filter.size}
                  </button>
                  <button
                    aria-label="All filters"
                    onClick={() => {
                      setPending(filter);
                      keyboard.hide();
                      setSheet("filters");
                    }}
                  >
                    <MixerHorizontalIcon />
                  </button>
                  <button
                    aria-label={map ? "Show list" : "Show map"}
                    onClick={() => setMap(!map)}
                  >
                    {map ? <ListBulletIcon /> : <GlobeIcon />}
                  </button>
                </div>
                {map && (
                  <DemoMap
                    label="Meals in central London"
                    selected={meal.area}
                    spots={mapGroups}
                    onSelect={(area) => {
                      const matches = allMatches.filter((m) => m.area === area);
                      setAreaIds(matches.map((m) => m.id));
                      if (matches[0]) setSelected(matches[0].id);
                    }}
                    onSearch={(areas) =>
                      setAreaIds(
                        allMatches
                          .filter((m) => areas.includes(m.area))
                          .map((m) => m.id),
                      )
                    }
                  />
                )}
                {map &&
                  allMatches.some(
                    (m) => !mapGroups.some((g) => g.id === m.area),
                  ) && (
                    <p className="muted">
                      Some restaurants are outside this illustrated map. Find
                      every matching table in the list below.
                    </p>
                  )}
                {areaIds && (
                  <button
                    className="text-action"
                    onClick={() => setAreaIds(null)}
                  >
                    Show all areas
                  </button>
                )}
                <p className="muted">
                  {browse.length} {browse.length === 1 ? "table" : "tables"} to
                  explore
                </p>
                {browse.map(card)}
                {!browse.length && (
                  <div className="empty">
                    <h3>No tables match just yet.</h3>
                    <Primary
                      secondary
                      onClick={() => {
                        setFilter({
                          date: "",
                          size: "",
                          budget: "",
                          language: "",
                        });
                        setQuery("");
                        setAreaIds(null);
                      }}
                    >
                      Clear filters
                    </Primary>
                    <Primary onClick={() => auth("create")}>
                      Create a meal
                    </Primary>
                  </div>
                )}
              </>
            )}
            {page === "detail" && (
              <>
                <div className="eyebrow">
                  {meal.area} · {meal.status.toLowerCase()}
                </div>
                <h1>{meal.title}</h1>
                <p>{meal.description}</p>
                {meal.lowCountUnresolvedAtStart && (
                  <div className="r1-notice" role="status">
                    The meal started without a recorded low-count decision. No
                    host agreement is implied; the original minimum remains
                    recorded.
                  </div>
                )}
                <div className="r1-facts">
                  <p>
                    <CalendarIcon />
                    {local(meal.startsAt)}
                  </p>
                  <p>
                    <PersonIcon />
                    {count} of {meal.capacity} confirmed · minimum{" "}
                    {meal.minimum}
                  </p>
                  <p>
                    {money(meal.budgetMin / 100)}–{money(meal.budgetMax / 100)}{" "}
                    per person
                  </p>
                  <p>
                    Each person pays for their own food and drinks at the
                    restaurant.
                  </p>
                </div>
                <h3>The restaurant</h3>
                <p>
                  {meal.venue}
                  <br />
                  <span className="muted">{meal.address}</span>
                </p>
                <a
                  className="r1-link"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meal.area + " London")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <SewingPinIcon />
                  Open neighbourhood in Google Maps
                </a>
                <p className="r1-notice">
                  {meal.booking === "DECLARED"
                    ? `The host has declared a reservation for ${meal.declaration?.count || count}.`
                    : "The host is arranging the reservation externally."}
                </p>
                <h3>Meet your table</h3>
                <div className="r1-people">
                  {confirmedIds(state, selected).map(avatar)}
                </div>
                <p className="muted">
                  {meal.languages.join(" · ").toUpperCase()} · Hosted by{" "}
                  {state.users.find((u) => u.id === meal.hostId)?.name}
                </p>
                <p className="muted">
                  Apply by {local(cutoffAt(meal, "apply"))}. Approval closes at{" "}
                  {local(cutoffAt(meal, "approve"))}. Reservation checked at{" "}
                  {local(cutoffAt(meal, "booking"))}.
                </p>
                {meal.status === "CANCELLED" && (
                  <div role="status" className="r1-notice">
                    This meal was cancelled. {meal.cancelReasons?.join(", ")}.
                    No in-app payment was taken.
                  </div>
                )}
                {host ? (
                  <Primary onClick={() => auth("host")}>
                    Manage your table
                  </Primary>
                ) : app?.state === "PENDING" ? (
                  <>
                    <div className="r1-notice">
                      Application pending · the host will review your
                      introduction. Group chat opens only when approved.
                    </div>
                    <Primary
                      secondary
                      onClick={() =>
                        run(
                          { type: "withdraw", applicationId: app.id },
                          "Application withdrawn. You may apply again before the deadline.",
                        )
                      }
                    >
                      Withdraw application
                    </Primary>
                  </>
                ) : app?.state === "CONFIRMED" &&
                  meal.status !== "CANCELLED" ? (
                  <>
                    <div className="r1-notice">
                      Your seat is confirmed. No second approval is needed for
                      the group.
                    </div>
                    <Primary onClick={() => auth("chat")}>
                      Open group chat
                    </Primary>
                    {meal.status === "OPEN" && (
                      <button
                        className="text-action"
                        onClick={() => {
                          keyboard.hide();
                          setSheet("leave");
                        }}
                      >
                        Leave this meal
                      </button>
                    )}
                  </>
                ) : meal.status === "OPEN" && app?.state !== "DECLINED" ? (
                  <Primary
                    disabled={
                      count >= meal.capacity ||
                      Date.parse(state.now) >=
                        Date.parse(cutoffAt(meal, "apply"))
                    }
                    onClick={() => auth("apply")}
                  >
                    {count >= meal.capacity ? "Table full" : "Apply to join"}
                  </Primary>
                ) : (
                  <p className="muted">
                    {app?.state === "DECLINED"
                      ? "Your application was declined. Explore another table."
                      : "Applications are closed."}
                  </p>
                )}
                {access === "read" && (
                  <Primary secondary onClick={() => auth("chat")}>
                    Read past group messages
                  </Primary>
                )}
                {meal.status === "COMPLETED" &&
                  eligibleAtMeal(state, meal.id, actor) && (
                    <Primary onClick={() => auth("review")}>
                      Your shared meal
                    </Primary>
                  )}
              </>
            )}
            {page === "apply" && (
              <>
                <div className="eyebrow">A LITTLE HELLO</div>
                <h1>Join {meal.title}</h1>
                <p>
                  The host reads your introduction and profile before confirming
                  your seat.
                </p>
                {field("Your introduction · 20–300 characters", text, setText, {
                  area: true,
                  maxLength: 300,
                })}
                <p>
                  Budget {money(meal.budgetMin / 100)}–
                  {money(meal.budgetMax / 100)}. Pay for your own order at the
                  restaurant.
                </p>
                <Primary
                  onClick={() => {
                    if (
                      run({ type: "apply", mealId: selected, message: text })
                    ) {
                      go("detail");
                      setNotice(
                        "Application sent. Your group opens after host approval.",
                      );
                    }
                  }}
                >
                  Send application
                </Primary>
              </>
            )}
            {page === "meals" && (
              <>
                <div className="eyebrow">YOUR TABLES</div>
                <h1>Plans worth keeping.</h1>
                {["Upcoming", "Past", "Cancelled"].map((section) => (
                  <section key={section}>
                    <h3>{section}</h3>
                    {groups
                      .filter((m) =>
                        section === "Upcoming"
                          ? m.status === "OPEN"
                          : section === "Past"
                            ? m.status === "COMPLETED"
                            : m.status === "CANCELLED",
                      )
                      .map(card)}
                  </section>
                ))}
                {!groups.length && <p>No meals yet. Find a table to start.</p>}
              </>
            )}
            {page === "inbox" && (
              <>
                <div className="eyebrow">BEFORE AND AFTER THE TABLE</div>
                <h1>A little hello.</h1>
                <h3>Your conversations</h3>
                {groups
                  .filter(
                    (m) =>
                      groupAccess(state, m.id, actor) !== "none" ||
                      state.applications.some(
                        (a) =>
                          a.mealId === m.id &&
                          a.userId === actor &&
                          a.state === "PENDING",
                      ),
                  )
                  .map((m) => (
                    <button
                      className="r1-row"
                      key={m.id}
                      onClick={() => {
                        setSelected(m.id);
                        go(
                          groupAccess(state, m.id, actor) === "none"
                            ? "detail"
                            : "chat",
                        );
                      }}
                    >
                      <ChatBubbleIcon />
                      <span>
                        <strong>{m.title}</strong>
                        <small>
                          {groupAccess(state, m.id, actor) === "none"
                            ? "Application pending · view status"
                            : groupAccess(state, m.id, actor) === "read"
                              ? "Read-only history"
                              : "Group chat open"}
                        </small>
                      </span>
                      <ChevronRightIcon />
                    </button>
                  ))}
                {state.users
                  .filter(
                    (u) =>
                      u.id !== actor &&
                      (canDirect(state, actor, u.id) ||
                        state.messages.some(
                          (m) =>
                            (m.from === actor && m.toId === u.id) ||
                            (m.from === u.id && m.toId === actor),
                        )),
                  )
                  .map((u) => (
                    <button
                      className="r1-row"
                      key={u.id}
                      onClick={() => {
                        setTarget(u.id);
                        go("direct");
                      }}
                    >
                      <span>
                        {u.name}
                        <small>
                          {canDirect(state, actor, u.id)
                            ? "Connected after a meal"
                            : "Read-only conversation"}
                        </small>
                      </span>
                    </button>
                  ))}
                <h3>Updates</h3>
                {state.notifications
                  .filter((n) => n.userId === actor)
                  .reverse()
                  .map((n) => (
                    <button
                      className="r1-row"
                      key={n.id}
                      onClick={() => {
                        run({
                          type: "read-notification",
                          notificationId: n.id,
                        });
                        if (n.mealId) {
                          setSelected(n.mealId);
                          go("detail");
                        }
                      }}
                    >
                      <span>
                        {n.text}
                        <small>
                          {local(n.at)}
                          {n.read ? "" : " · New"}
                        </small>
                      </span>
                    </button>
                  ))}
                {!groups.length && (
                  <p>
                    Your pending applications and confirmed groups will appear
                    here.
                  </p>
                )}
              </>
            )}
            {page === "chat" && (
              <>
                <h1>{meal.title}</h1>
                <p className="muted">
                  {access === "write"
                    ? "Your confirmed table"
                    : "Read-only history from your confirmed membership"}
                </p>
                {access === "none" ? (
                  <div className="empty">
                    Your place must be confirmed by the host before this group
                    opens.
                    <Primary onClick={() => go("detail")}>
                      View application status
                    </Primary>
                  </div>
                ) : (
                  <>
                    {readableMessages(state, selected, actor).map((m) => (
                      <div
                        className={`r1-message ${m.from === actor ? "own" : ""}`}
                        key={m.id}
                      >
                        <strong>
                          {state.users.find((u) => u.id === m.from)?.name}
                        </strong>
                        <p>{m.text}</p>
                        <small>{local(m.at)}</small>
                      </div>
                    ))}
                    {!readableMessages(state, selected, actor).length && (
                      <div className="empty">Say hello to your table.</div>
                    )}
                    {access === "write" && (
                      <>
                        {field("Message your group", text, setText, {
                          maxLength: 2000,
                          area: true,
                        })}
                        <Primary
                          onClick={() => {
                            if (run({ type: "send", mealId: selected, text }))
                              setText("");
                          }}
                        >
                          Send message
                        </Primary>
                      </>
                    )}
                  </>
                )}
              </>
            )}
            {page === "host" && (
              <>
                <div className="eyebrow">YOUR TABLE</div>
                <h1>Bring people together.</h1>
                {!host ? (
                  <p>You don’t host this meal.</p>
                ) : (
                  <>
                    <h3>{meal.title}</h3>
                    <p>
                      {count} confirmed · minimum {meal.minimum} ·{" "}
                      {meal.status.toLowerCase()}
                    </p>
                    <p>
                      Once a guest is confirmed, venue, time and cost
                      arrangements are locked. Cancel and publish a new meal to
                      change them.
                    </p>
                    {meal.lowCountDecision === "pending" && (
                      <div className="r1-notice">
                        <p>
                          {Date.parse(state.now) < Date.parse(meal.startsAt)
                            ? "The group is smaller than the original minimum. Choose whether to continue, then contact the restaurant."
                            : "The original minimum and the unmade decision remain recorded."}
                        </p>
                        {Date.parse(state.now) < Date.parse(meal.startsAt) ? (
                          <Primary
                            onClick={() =>
                              run(
                                { type: "continue", mealId: selected },
                                "You chose to continue with the smaller group.",
                              )
                            }
                          >
                            Continue with {count} people
                          </Primary>
                        ) : (
                          <p>
                            The meal started without a recorded decision. No
                            host agreement is implied. This record is read-only.
                          </p>
                        )}
                      </div>
                    )}
                    {!!meal.lowCountHistory?.length && (
                      <section>
                        <h3>Group-size decisions</h3>
                        {meal.lowCountHistory.map((entry, index) => (
                          <p className="muted" key={index}>
                            {entry.kind} · {entry.count} people ·{" "}
                            {local(entry.at)}
                          </p>
                        ))}
                      </section>
                    )}
                    <h3>Applications</h3>
                    {state.applications
                      .filter(
                        (a) => a.mealId === selected && a.state === "PENDING",
                      )
                      .map((a) => (
                        <div className="r1-card" key={a.id}>
                          <button
                            className="text-action"
                            onClick={() => {
                              setTarget(a.userId);
                              go("member");
                            }}
                          >
                            View{" "}
                            {state.users.find((u) => u.id === a.userId)?.name}’s
                            profile
                          </button>
                          <p>{a.message}</p>
                          <Primary
                            onClick={() =>
                              run(
                                { type: "approve", applicationId: a.id },
                                "Seat confirmed. The guest can enter the group immediately.",
                              )
                            }
                          >
                            Approve seat
                          </Primary>
                          <Primary
                            secondary
                            onClick={() =>
                              run(
                                { type: "decline", applicationId: a.id },
                                "Application declined.",
                              )
                            }
                          >
                            Decline
                          </Primary>
                        </div>
                      ))}
                    {meal.status === "OPEN" &&
                      Date.parse(state.now) < Date.parse(meal.startsAt) && (
                        <>
                          <h3>Restaurant reservation</h3>
                          <p>
                            Book outside Fancy for {count} confirmed people.
                            Reconfirm here if the headcount changes before the
                            deadline.
                          </p>
                          <Primary
                            onClick={() => {
                              keyboard.hide();
                              setSheet("declare");
                            }}
                          >
                            Declare reservation for {count}
                          </Primary>
                          {field(
                            "Title",
                            draft.title || meal.title,
                            (v) => setDraft({ ...draft, title: v }),
                            { maxLength: 80 },
                          )}
                          {field(
                            "Description",
                            draft.description || meal.description,
                            (v) => setDraft({ ...draft, description: v }),
                            { maxLength: 1000, area: true },
                          )}
                          <Primary
                            secondary
                            onClick={() =>
                              run(
                                {
                                  type: "edit",
                                  mealId: selected,
                                  title: draft.title || meal.title,
                                  description:
                                    draft.description || meal.description,
                                },
                                "Description updated. Confirmed arrangements are unchanged.",
                              )
                            }
                          >
                            Save description
                          </Primary>
                          <button
                            className="text-action"
                            onClick={() => {
                              keyboard.hide();
                              setReason("host");
                              setSheet("cancel");
                            }}
                          >
                            Cancel entire meal
                          </button>
                        </>
                      )}
                    {meal.status === "CANCELLED" && (
                      <Primary
                        onClick={() => {
                          setDraft({
                            ...draft,
                            title: meal.title,
                            description: meal.description,
                            venue: meal.venue,
                            address: meal.address,
                            area: meal.area,
                            replacementFor: meal.id,
                          });
                          setStep(0);
                          go("create");
                        }}
                      >
                        Create replacement meal
                      </Primary>
                    )}
                    <Primary secondary onClick={() => go("chat")}>
                      Open group
                    </Primary>
                  </>
                )}
              </>
            )}
            {page === "create" && (
              <>
                <div className="eyebrow">CREATE A MEAL · {step + 1} OF 4</div>
                <h1>
                  {
                    [
                      "Choose your table.",
                      "Make a little time.",
                      "Set expectations.",
                      "A seat for someone new.",
                    ][step]
                  }
                </h1>
                <div className="r1-progress">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={i <= step ? "active" : ""} />
                  ))}
                </div>
                {step === 0 && (
                  <>
                    <VenueMap
                      value={draft.venue}
                      onConfirm={(v) =>
                        setDraft({
                          ...draft,
                          venue: v.name,
                          area: v.area,
                          address: `${v.area}, London`,
                        })
                      }
                    />
                    <p>Or add your restaurant directly.</p>
                    {field(
                      "Restaurant name",
                      draft.venue,
                      (v) => setDraft({ ...draft, venue: v }),
                      { maxLength: 100 },
                    )}
                    {field(
                      "Address",
                      draft.address,
                      (v) => setDraft({ ...draft, address: v }),
                      { maxLength: 200 },
                    )}
                    {field(
                      "Neighbourhood",
                      draft.area,
                      (v) => setDraft({ ...draft, area: v }),
                      { maxLength: 80 },
                    )}
                  </>
                )}
                {step === 1 && (
                  <>
                    {field(
                      "Date · London",
                      draft.date,
                      (v) => setDraft({ ...draft, date: v, instant: "" }),
                      { type: "date" },
                    )}
                    {field(
                      "Time · Europe/London",
                      draft.time,
                      (v) => setDraft({ ...draft, time: v, instant: "" }),
                      { type: "time" },
                    )}
                    {londonInstants(draft.date, draft.time).length === 2 && (
                      <ChoiceGroup
                        label="This time occurs twice. Choose the UTC offset."
                        value={draft.instant}
                        onChange={(instant) => setDraft({ ...draft, instant })}
                        options={londonInstants(draft.date, draft.time).map(
                          (v, i) => [
                            v,
                            `${i === 0 ? "First · BST" : "Second · GMT"} (${v.slice(11, 16)} UTC)`,
                          ],
                        )}
                      />
                    )}
                    <p className="muted">
                      Meals last about 2 hours. Publish at least 60 minutes
                      before the start.
                    </p>
                    {choose(
                      "People, including you",
                      draft.capacity,
                      (v) => setDraft({ ...draft, capacity: v }),
                      ["2", "3", "4", "5", "6"],
                    )}
                    <p>
                      Minimum: {minimumFor(Number(draft.capacity))} confirmed
                      people.
                    </p>
                  </>
                )}
                {step === 2 && (
                  <>
                    {field(
                      "Budget from (£ per person)",
                      draft.budgetMin,
                      (v) => setDraft({ ...draft, budgetMin: v }),
                      { type: "number" },
                    )}
                    {field(
                      "Budget up to (£ per person)",
                      draft.budgetMax,
                      (v) => setDraft({ ...draft, budgetMax: v }),
                      { type: "number" },
                    )}
                    <p className="r1-notice">
                      Each guest pays for their own order at the restaurant.
                      Fancy does not collect a deposit.
                    </p>
                    {choose(
                      "Conversation language",
                      draft.language,
                      (v) => setDraft({ ...draft, language: v }),
                      ["en", "zh", "fr", "es"],
                    )}
                    {field(
                      "Meal title · 5–80 characters",
                      draft.title,
                      (v) => setDraft({ ...draft, title: v }),
                      { maxLength: 80 },
                    )}
                    {field(
                      "What’s the plan? · 20–1000 characters",
                      draft.description,
                      (v) => setDraft({ ...draft, description: v }),
                      { area: true, maxLength: 1000 },
                    )}
                  </>
                )}
                {step === 3 && (
                  <>
                    <h3>{draft.title}</h3>
                    <p>
                      {draft.venue}
                      <br />
                      {draft.address}
                      <br />
                      {draft.date} · {draft.time} London
                      <br />
                      {draft.capacity} people including you
                      <br />
                      {money(Number(draft.budgetMin))}–
                      {money(Number(draft.budgetMax))} per person
                    </p>
                    <p>{draft.description}</p>
                    <p>
                      You can publish before booking. Declare an external
                      reservation matching your confirmed headcount before the
                      15-minute check, or the meal will cancel automatically.
                    </p>
                  </>
                )}
                {step > 0 && (
                  <Primary
                    secondary
                    onClick={() => {
                      keyboard.hide();
                      setStep(step - 1);
                    }}
                  >
                    Back
                  </Primary>
                )}
                <Primary
                  onClick={() => {
                    keyboard.hide();
                    setIssue("");
                    const instants = londonInstants(draft.date, draft.time),
                      instant = draft.instant || instants[0];
                    if (
                      step === 0 &&
                      (!draft.venue.trim() ||
                        !draft.address.trim() ||
                        !draft.area.trim())
                    ) {
                      setIssue(
                        "Add the restaurant name, address and neighbourhood.",
                      );
                      return;
                    }
                    if (
                      step === 1 &&
                      (!instant ||
                        (instants.length === 2 && !draft.instant) ||
                        Date.parse(instant) - Date.parse(state.now) < HOUR)
                    ) {
                      setIssue(
                        "Choose a valid London time at least 60 minutes away; select the offset if the hour repeats.",
                      );
                      return;
                    }
                    if (
                      step === 2 &&
                      (!Number.isFinite(Number(draft.budgetMin)) ||
                        Number(draft.budgetMin) <= 0 ||
                        Number(draft.budgetMax) < Number(draft.budgetMin) ||
                        draft.title.trim().length < 5 ||
                        draft.description.trim().length < 20)
                    ) {
                      setIssue(
                        "Add a positive budget range, title and introduction.",
                      );
                      return;
                    }
                    if (step < 3) {
                      setStep(step + 1);
                      return;
                    }
                    const next = run({
                      type: "publish",
                      meal: {
                        ...draft,
                        startsAt: instant,
                        capacity: Number(draft.capacity),
                        budgetMin: Math.round(Number(draft.budgetMin) * 100),
                        budgetMax: Math.round(Number(draft.budgetMax) * 100),
                        languages: [draft.language],
                        replacementFor: draft.replacementFor || undefined,
                      },
                    });
                    if (next) {
                      setSelected(next.meals.at(-1)!.id);
                      go("detail");
                      setNotice(
                        "Your meal is published. You’re the host; arrange the reservation externally.",
                      );
                    }
                  }}
                >
                  {step === 3 ? "Publish meal" : "Continue"}
                </Primary>
                <button className="text-action" onClick={() => go("discover")}>
                  Save draft & close
                </button>
              </>
            )}
            {(page === "profile" || page === "member") && (
              <>
                <div className="eyebrow">A LITTLE BACKGROUND</div>
                <h1>{page === "profile" ? self.name : member.name}</h1>
                <div className="r1-people">
                  {avatar(page === "profile" ? actor : target)}
                </div>
                <h3>A little about me</h3>
                <p>
                  {page === "profile"
                    ? self.bio
                    : "bio" in member
                      ? member.bio
                      : "Sign in to view this profile."}
                </p>
                <h3>We could talk about</h3>
                <p>
                  {(page === "profile"
                    ? self.interests
                    : "interests" in member
                      ? member.interests
                      : []
                  )?.join(" · ")}
                </p>
                <p>
                  {(page === "profile"
                    ? self.languages
                    : "languages" in member
                      ? member.languages
                      : []
                  )
                    ?.join(" · ")
                    .toUpperCase()}
                </p>
                {page === "profile" ? (
                  <>
                    <Primary
                      secondary
                      onClick={() => {
                        setEditName(self.name);
                        setEditBio(self.bio);
                        go("edit");
                      }}
                    >
                      Edit profile
                    </Primary>
                    <Primary secondary onClick={() => go("settings")}>
                      Settings
                    </Primary>
                  </>
                ) : (
                  target !== actor && (
                    <>
                      <Primary
                        secondary
                        onClick={() => {
                          setReason("");
                          keyboard.hide();
                          setSheet("report");
                        }}
                      >
                        Report a concern
                      </Primary>
                      <button
                        className="text-action"
                        onClick={() =>
                          run(
                            {
                              type: "block",
                              userId: target,
                              blocked: !state.blocks.some(
                                (b) => b.from === actor && b.to === target,
                              ),
                            },
                            "Privacy preference updated. Reconnecting needs fresh consent after unblocking.",
                          )
                        }
                      >
                        {state.blocks.some(
                          (b) => b.from === actor && b.to === target,
                        )
                          ? "Unblock member"
                          : "Block member"}
                      </button>
                    </>
                  )
                )}
              </>
            )}
            {page === "edit" && (
              <>
                <h1>A little more you.</h1>
                {field("Name · 2–40 characters", editName, setEditName, {
                  maxLength: 40,
                })}
                {field(
                  "Introduction · 20–1000 characters",
                  editBio,
                  setEditBio,
                  { maxLength: 1000, area: true },
                )}
                <Primary
                  onClick={() => {
                    if (
                      run({
                        type: "profile",
                        name: editName,
                        bio: editBio,
                        languages: self.languages,
                        interests: self.interests,
                      })
                    )
                      go("profile");
                  }}
                >
                  Save profile
                </Primary>
              </>
            )}
            {page === "review" && (
              <>
                <h1>How was your table?</h1>
                <p>
                  {meal.title} · Your latest attendance report takes priority
                  over the host’s supplement.
                </p>
                <p>
                  Your attendance: <strong>{result}</strong>
                </p>
                {state.attendance
                  .filter((a) => a.mealId === selected && a.userId === actor)
                  .map((a, i) => (
                    <small className="r1-source" key={i}>
                      {a.source === "self" ? "You" : "Host"} reported {a.value}{" "}
                      · {local(a.at)}
                    </small>
                  ))}
                {editingWindow ? (
                  <>
                    <Primary
                      onClick={() =>
                        run(
                          {
                            type: "attendance",
                            mealId: selected,
                            userId: actor,
                            value: "present",
                          },
                          "Attendance updated.",
                        )
                      }
                    >
                      I attended
                    </Primary>
                    <Primary
                      secondary
                      onClick={() =>
                        run(
                          {
                            type: "attendance",
                            mealId: selected,
                            userId: actor,
                            value: "absent",
                          },
                          "Attendance updated. Sending permissions are recalculated.",
                        )
                      }
                    >
                      I didn’t attend
                    </Primary>
                    {host && (
                      <>
                        <h3>Missing reports</h3>
                        {confirmedIds(state, selected, meal.startsAt)
                          .filter(
                            (id) =>
                              id !== actor &&
                              !state.attendance.some(
                                (a) =>
                                  a.mealId === selected &&
                                  a.userId === id &&
                                  a.source === "self",
                              ),
                          )
                          .map((id) => (
                            <div key={id}>
                              <p>
                                {state.users.find((u) => u.id === id)?.name}
                              </p>
                              <button
                                className="r1-chip"
                                onClick={() =>
                                  run({
                                    type: "attendance",
                                    mealId: selected,
                                    userId: id,
                                    value: "present",
                                  })
                                }
                              >
                                Attended
                              </button>
                              <button
                                className="r1-chip"
                                onClick={() =>
                                  run({
                                    type: "attendance",
                                    mealId: selected,
                                    userId: id,
                                    value: "absent",
                                  })
                                }
                              >
                                Didn’t attend
                              </button>
                            </div>
                          ))}
                      </>
                    )}
                    {result === "present" && (
                      <>
                        <h3>Private whole-meal feedback</h3>
                        {choose("Overall experience", score, setScore, [
                          "1",
                          "2",
                          "3",
                          "4",
                          "5",
                        ])}
                        {choose(
                          "Would you join another meal?",
                          again,
                          setAgain,
                          ["yes", "no"],
                        )}
                        <fieldset className="filter-section">
                          <legend>
                            What shaped your experience? · optional, choose any
                          </legend>
                          <div className="choice-grid">
                            {[
                              "company",
                              "conversation",
                              "coordination",
                              "expectations",
                              "venue",
                              "cost",
                              "other",
                            ].map((code) => (
                              <label
                                className={`choice-chip ${feedbackReasons.includes(code) ? "chosen" : ""}`}
                                key={code}
                              >
                                <input
                                  type="checkbox"
                                  checked={feedbackReasons.includes(code)}
                                  onChange={(e) =>
                                    setFeedbackReasons((values) =>
                                      e.target.checked
                                        ? [...values, code]
                                        : values.filter((v) => v !== code),
                                    )
                                  }
                                />
                                <span>
                                  {code[0].toUpperCase() + code.slice(1)}
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <button
                          className="text-action"
                          onClick={() => setFeedbackReasons([])}
                        >
                          Clear reasons
                        </button>
                        <Primary
                          onClick={() =>
                            run(
                              {
                                type: "feedback",
                                mealId: selected,
                                score: score ? Number(score) : undefined,
                                again: again ? again === "yes" : undefined,
                                reasons: feedbackReasons,
                              },
                              "Private feedback saved. It is not published on member profiles.",
                            )
                          }
                        >
                          Save private feedback
                        </Primary>
                      </>
                    )}
                  </>
                ) : (
                  <p className="r1-notice">
                    Reports and new connections can be updated for 7 days after
                    the scheduled end. You can retract a connection or block
                    someone at any time.
                  </p>
                )}
                <h3>Keep in touch</h3>
                {confirmedIds(state, selected, meal.startsAt)
                  .filter((id) => id !== actor)
                  .map((id) => {
                    const wants = state.reconnect.find(
                      (r) =>
                        r.mealId === selected &&
                        r.from === actor &&
                        r.to === id,
                    )?.wants;
                    return (
                      <div className="r1-card" key={id}>
                        <div className="r1-people">
                          {avatar(id)}
                          <strong>
                            {state.users.find((u) => u.id === id)?.name}
                          </strong>
                        </div>
                        <p>
                          Your choice stays private unless you both choose to
                          connect.
                        </p>
                        <Primary
                          secondary
                          disabled={
                            !wants && (!editingWindow || result !== "present")
                          }
                          onClick={() =>
                            run(
                              {
                                type: "reconnect",
                                mealId: selected,
                                userId: id,
                                wants: !wants,
                              },
                              wants
                                ? "Connection retracted."
                                : "Your choice is saved privately.",
                            )
                          }
                        >
                          {wants
                            ? "Retract connection"
                            : "I’d like to stay in touch"}
                        </Primary>
                        {canDirect(state, actor, id) && (
                          <Primary
                            onClick={() => {
                              setTarget(id);
                              go("direct");
                            }}
                          >
                            Open private chat
                          </Primary>
                        )}
                      </div>
                    );
                  })}
              </>
            )}
            {page === "direct" && (
              <>
                <h1>{state.users.find((u) => u.id === target)?.name}</h1>
                <p>
                  {canDirect(state, actor, target)
                    ? "You both chose to keep in touch."
                    : "Read-only · consent and attendance are required to send."}
                </p>
                {state.messages
                  .filter(
                    (m) =>
                      (m.from === actor && m.toId === target) ||
                      (m.from === target && m.toId === actor),
                  )
                  .map((m) => (
                    <div className="r1-message" key={m.id}>
                      <p>{m.text}</p>
                      <small>{local(m.at)}</small>
                    </div>
                  ))}
                {canDirect(state, actor, target) && (
                  <>
                    {field("Private message", text, setText, {
                      area: true,
                      maxLength: 2000,
                    })}
                    <Primary
                      onClick={() => {
                        if (run({ type: "direct", userId: target, text }))
                          setText("");
                      }}
                    >
                      Send message
                    </Primary>
                  </>
                )}
                <button
                  className="text-action"
                  onClick={() =>
                    run(
                      {
                        type: "reconnect",
                        mealId:
                          state.reconnect.find(
                            (r) => r.from === actor && r.to === target,
                          )?.mealId || selected,
                        userId: target,
                        wants: false,
                      },
                      "Connection retracted.",
                    )
                  }
                >
                  Retract connection
                </button>
              </>
            )}
            {page === "settings" && (
              <>
                <h1>Make yourself comfortable.</h1>
                <h3>Notifications</h3>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={updates}
                    onChange={(e) => setUpdates(e.target.checked)}
                  />
                  <span>Optional meal recommendations by email</span>
                </label>
                <p>
                  Applications, cancellations and account security still appear
                  in your updates and email. Push is an additional iOS channel.
                </p>
                <h3>Privacy</h3>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>Allow optional product analytics</span>
                </label>
                <p>
                  Changing this choice stops future optional collection. It does
                  not change essential meal records.
                </p>
                <Primary
                  secondary
                  onClick={() =>
                    download(exportAccount(state, actor), "fancy-my-data.json")
                  }
                >
                  Export my data
                </Primary>
                <Primary
                  secondary
                  onClick={() => {
                    keyboard.hide();
                    setSheet("support");
                  }}
                >
                  Community & support
                </Primary>
                <Primary
                  secondary
                  onClick={() => {
                    setSigned(false);
                    go("discover");
                    setEntrance("account");
                  }}
                >
                  Sign out
                </Primary>
                <button
                  className="text-action"
                  onClick={() => {
                    setDeletion("");
                    setReauth(false);
                    keyboard.hide();
                    setSheet("delete");
                  }}
                >
                  Delete account
                </button>
                <ReviewOnly>
                  <section className="r1-review-tools">
                    <h3>R1 acceptance tools</h3>
                    <p>
                      Local fixtures only. OAuth, email and notifications do not
                      contact providers. Reload resets this session.
                    </p>
                    {choose(
                      "Actor",
                      actor,
                      (v) => {
                        setActor(v);
                        go("settings");
                      },
                      state.users
                        .filter((u) => !u.deleted && u.id !== "operator")
                        .map((u) => u.id),
                    )}
                    {field("Acceptance clock · UTC", clock, setClock, {
                      type: "datetime-local",
                    })}
                    <Primary
                      secondary
                      onClick={() => {
                        try {
                          setState((s) =>
                            act(
                              s,
                              "system",
                              { type: "tick", key: crypto.randomUUID() },
                              new Date(clock + "Z").toISOString(),
                            ),
                          );
                          setIssue("");
                          setNotice(
                            "Deadlines evaluated at their scheduled instants.",
                          );
                        } catch (e) {
                          setIssue(String(e));
                        }
                      }}
                    >
                      Advance clock
                    </Primary>
                    {choose("Connection", connection, setConnection, [
                      "online",
                      "offline",
                      "unavailable",
                    ])}
                    <Primary
                      secondary
                      onClick={() =>
                        download(
                          projectAnalytics(state),
                          "fancy-r1-analytics.json",
                        )
                      }
                    >
                      Export sanitized admin handoff
                    </Primary>
                    <a href="?scope=future&review=1">
                      Explore future payments & booking
                    </a>
                  </section>
                </ReviewOnly>
              </>
            )}
          </main>
        </MobileScroll>
        <nav className="r1-nav" aria-label="Main navigation">
          {navItems.map(([id, label, icon]) => (
            <button
              key={id}
              className={`${page === id ? "active" : ""} ${id === "create" ? "create" : ""}`}
              onClick={() => (id === "discover" ? go(id) : auth(id))}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <BottomSheet
          open={["date", "size", "filters"].includes(sheet)}
          onOpenChange={(o) => !o && setSheet("")}
          title={
            sheet === "date"
              ? "Choose a date"
              : sheet === "size"
                ? "Choose a table size"
                : "Find your kind of table"
          }
        >
          <div className="body-pad">
            {sheet !== "size" &&
              field(
                "Date · London",
                pending.date,
                (v) => setPending({ ...pending, date: v }),
                { type: "date" },
              )}
            {sheet !== "date" && (
              <ChoiceGroup
                label="People, including the host"
                value={pending.size}
                onChange={(size) => setPending({ ...pending, size })}
                options={["", "2", "3", "4", "5", "6"].map((v) => [
                  v,
                  v || "Any size",
                ])}
              />
            )}{" "}
            {sheet === "filters" && (
              <>
                {choose(
                  "Maximum budget per person (£)",
                  pending.budget,
                  (v) => setPending({ ...pending, budget: v }),
                  ["", "25", "35", "50"],
                )}
                {choose(
                  "Conversation language",
                  pending.language,
                  (v) => setPending({ ...pending, language: v }),
                  ["", "en", "zh", "fr", "es"],
                )}
              </>
            )}
            <Primary
              onClick={() => {
                setFilter(pending);
                keyboard.hide();
                setSheet("");
              }}
            >
              Show tables
            </Primary>
            <button
              className="text-action"
              onClick={() => {
                setPending({ date: "", size: "", budget: "", language: "" });
              }}
            >
              Clear selections
            </button>
          </div>
        </BottomSheet>
        <BottomSheet
          open={[
            "leave",
            "cancel",
            "declare",
            "delete",
            "report",
            "support",
          ].includes(sheet)}
          onOpenChange={(o) => !o && setSheet("")}
          title={
            sheet === "declare"
              ? "Confirm your external booking"
              : sheet === "delete"
                ? "Delete your account?"
                : sheet === "report"
                  ? "Report a concern"
                  : sheet === "support"
                    ? "Community & support"
                    : "Review your change"
          }
        >
          <div className="body-pad">
            {sheet === "declare" && (
              <>
                <p>
                  I booked {meal.venue} outside Fancy for {count} confirmed
                  people at {local(meal.startsAt)}. This declaration is not
                  supplier confirmation.
                </p>
                <Primary
                  onClick={() => {
                    if (
                      run(
                        { type: "declare", mealId: selected },
                        "Reservation declaration saved.",
                      )
                    )
                      setSheet("");
                  }}
                >
                  Confirm declaration for {count}
                </Primary>
              </>
            )}
            {sheet === "leave" && (
              <>
                <p>
                  Your seat will be released. Your previous group messages
                  remain read-only. You can reapply before applications close;
                  the host must approve the new application.
                </p>
                <Primary
                  onClick={() => {
                    if (
                      run(
                        { type: "leave", mealId: selected },
                        "You left this meal.",
                      )
                    )
                      setSheet("");
                  }}
                >
                  Confirm leaving
                </Primary>
              </>
            )}
            {sheet === "cancel" && (
              <>
                <p>
                  This cancels the entire meal and notifies applicants and
                  confirmed guests. Contact the restaurant separately to cancel
                  its booking.
                </p>
                {choose("Cancellation reason", reason, setReason, [
                  "host",
                  "host_changed",
                  "other",
                ])}
                <Primary
                  onClick={() => {
                    if (
                      run(
                        {
                          type: "cancel",
                          mealId: selected,
                          reason: reason || "host",
                        },
                        "Meal cancelled.",
                      )
                    )
                      setSheet("");
                  }}
                >
                  Cancel entire meal
                </Primary>
              </>
            )}
            {sheet === "delete" && (
              <>
                <p>
                  Deleting your account cancels hosted meals that haven’t
                  started, withdraws upcoming participation, removes your
                  profile and personal messages, and revokes connections.
                  Historical meal records are deidentified. This cannot be
                  undone.
                </p>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={reauth}
                    onChange={(e) => setReauth(e.target.checked)}
                  />
                  <span>Confirm my identity again</span>
                </label>
                {field("Type DELETE", deletion, setDeletion)}
                <Primary
                  onClick={() => {
                    if (
                      run({
                        type: "delete-account",
                        confirmation: deletion,
                        reauthenticated: reauth,
                      })
                    ) {
                      setSigned(false);
                      setSheet("");
                      setEntrance("splash");
                      setPage("discover");
                    }
                  }}
                >
                  Delete account permanently
                </Primary>
              </>
            )}
            {sheet === "report" && (
              <>
                <p>
                  Your report is private. You’ll receive a case reference. You
                  can block this member immediately.
                </p>
                {field(
                  "What happened? · 5–1000 characters",
                  reason,
                  setReason,
                  { area: true, maxLength: 1000 },
                )}
                <Primary
                  onClick={() => {
                    const next = run({
                      type: "report",
                      userId: target,
                      reason,
                    });
                    if (next) {
                      setSheet("");
                      setNotice(`Report received: ${next.reports.at(-1)?.id}.`);
                    }
                  }}
                >
                  Submit report
                </Primary>
              </>
            )}
            {sheet === "support" && (
              <>
                <p>
                  Respect boundaries, meet in public restaurants and don’t share
                  another person’s details without permission. Use Report a
                  concern on a member profile and block unwanted contact.
                </p>
                <p>Your submitted cases</p>
                {state.reports
                  .filter((r) => r.actorId === actor)
                  .map((r) => (
                    <p key={r.id}>
                      {r.id} · {r.status}
                    </p>
                  ))}
                <ReviewOnly>
                  <p>
                    Launch dependency: configure a verified contact address,
                    community policy and privacy notice. No response SLA or real
                    provider delivery is represented here.
                  </p>
                </ReviewOnly>
              </>
            )}
            <button
              className="text-action"
              onClick={() => {
                keyboard.hide();
                setSheet("");
              }}
            >
              Back
            </button>
          </div>
        </BottomSheet>
        <MealHelper
          meals={browse
            .filter(
              (m) =>
                Date.parse(state.now) < Date.parse(cutoffAt(m, "apply")) &&
                confirmedIds(state, m.id).length < m.capacity,
            )
            .map((m) => ({
              ...initialMeals[0],
              id: m.id,
              title: m.title,
              description: m.description,
              venue: m.venue,
              area: m.area,
              date: m.startsAt.slice(0, 10),
              time: new Intl.DateTimeFormat("en-GB", {
                timeZone: "Europe/London",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(m.startsAt)),
              capacity: m.capacity,
              confirmed: confirmedIds(state, m.id).length,
              min: m.budgetMin / 100,
              max: m.budgetMax / 100,
              host: m.hostId,
              members: confirmedIds(state, m.id),
              language: m.languages.join(" · "),
              costMode: "OFFLINE",
              deposit: 0,
              reservationSource: "external",
              owned: m.hostId === actor,
            }))}
          voiceEnabled={false}
          current={{
            ...initialMeals[0],
            id: meal.id,
            title: meal.title,
            description: meal.description,
            venue: meal.venue,
            area: meal.area,
            date: meal.startsAt.slice(0, 10),
            time: new Intl.DateTimeFormat("en-GB", {
              timeZone: "Europe/London",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(meal.startsAt)),
            capacity: meal.capacity,
            confirmed: count,
            min: meal.budgetMin / 100,
            max: meal.budgetMax / 100,
            host: meal.hostId,
            members: confirmedIds(state, meal.id),
            owned: host,
            costMode: "OFFLINE",
            deposit: 0,
            booking: meal.status === "CANCELLED" ? "CANCELLED" : "PENDING",
            reservationSource: "external",
          }}
          filters={emptyFilters}
          page={page}
          visible={["discover", "detail", "create", "apply"].includes(page)}
          onMeal={open}
          onAction={(action) => {
            keyboard.hide();
            if (action.kind === "create") {
              setDraft({
                ...draft,
                title: "A table for new friends",
                description: action.text,
              });
              setStep(0);
              auth("create");
            } else if (action.kind === "application") {
              if (
                action.mealId &&
                state.meals.some((m) => m.id === action.mealId)
              )
                setSelected(action.mealId);
              auth("apply");
              setText(action.text || "");
            } else if (action.kind === "message") {
              if (access !== "write") {
                setNotice(
                  "Only confirmed participants can send to the meal group.",
                );
                return;
              }
              auth("chat");
              setText(action.text || "");
            } else setNotice("Review your meal choices before applying.");
          }}
        />
      </div>
    </SelfProfileContext.Provider>
  );
}

export default function Prototype() {
  return new URLSearchParams(window.location.search).get("scope") ===
    "future" ? (
    <FuturePrototype />
  ) : (
    <PilotPrototype />
  );
}
