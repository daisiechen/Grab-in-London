import {
  useEffect,
  useRef,
  useState,
  useId,
  createContext,
  useContext,
  type ReactNode,
} from "react";
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
  useScreenPortal,
} from "./mobile";
import {
  initialMeals,
  members,
  eligibleMeals,
  applyToMeal,
  approveApplication,
  completePayment,
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
const money = (value: number) => `£${value}`;
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
      className={`primary ${secondary ? "secondary" : ""}`}
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
          <button aria-label="Next month" onClick={() => changeMonth(1)}>
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
        <span /> Meals available · London time
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
  const [agreed, setAgreed] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expired, setExpired] = useState(false);
  const [codeVersion, setCodeVersion] = useState(0);
  const [provider, setProvider] = useState("");
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
    <div className="brand-wordmark" aria-label="Grab in London">
      grab<span>in London</span>
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
          <p>A little room for someone new.</p>
        </div>
        <button onClick={() => move("welcome")}>
          Skip intro <ArrowRightIcon />
        </button>
        <small>MEET NEW PEOPLE OVER A MEAL</small>
      </div>
    );
  return (
    <div className="grab-app brand-entrance">
      <div className="brand-demo-label">
        DESIGN PROTOTYPE · DEMO ACCOUNTS ONLY
      </div>
      <MobileScroll key={stage} className="brand-scroll">
        <div
          className={`brand-content ${stage === "welcome" ? "brand-welcome" : ""}`}
        >
          {stage === "welcome" ? (
            <>
              <header>
                {wordmark}
                <span className="brand-city">LONDON, LET’S EAT.</span>
              </header>
              <div className="brand-art">
                <img
                  src="/images/brand-table.png"
                  alt="A sculptural green table with colourful chairs, laid for new friends"
                />
              </div>
              <div className="brand-welcome-copy">
                <div className="eyebrow">GOOD FOOD. NEW FACES.</div>
                <h1>
                  There’s room
                  <br />
                  for you here.
                </h1>
                <p>Meet new people over a meal.</p>
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
              <button
                className="brand-browse brand-replay"
                onClick={() => move("splash")}
              >
                Replay intro
              </button>
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
                      ? `In the real app, we’d send a code to ${email}. Here, use 123456.`
                      : "Give your future table a little context. Your email stays private."}
              </p>
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
                    Preview Google sign-in <ExternalLinkIcon />
                  </button>
                  <button
                    className="brand-provider"
                    onClick={() => {
                      setProvider("Apple");
                      setIssue("");
                    }}
                  >
                    Preview Apple sign-in <ExternalLinkIcon />
                  </button>
                  <p className="demo-note">
                    Simulated sign-in only. No provider opens and no personal
                    data is sent.
                  </p>
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
                  <p className="demo-note">
                    Use a sample address. No email will be sent.
                  </p>
                  <Primary
                    onClick={() => {
                      const error = validateDemoEmail(email);
                      if (error) {
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
                    Send demo code <ArrowRightIcon />
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
                        setIssue(error);
                        return;
                      }
                      keyboard.hide();
                      finishIdentity();
                    }}
                  >
                    {intent === "returning"
                      ? "Log in to demo"
                      : "Verify & continue"}
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
                      setIssue("New demo code ready: 123456.");
                    }}
                  >
                    {cooldown ? `Resend in ${cooldown}s` : "Resend demo code"}
                  </button>
                  <button className="text-action" onClick={() => move("email")}>
                    Change email
                  </button>
                  <button
                    className="text-action"
                    onClick={() => {
                      setExpired(true);
                      setIssue(
                        "Demo: the code has expired. Request a new code when resend is ready.",
                      );
                    }}
                  >
                    Preview expired code
                  </button>
                </>
              )}
              {stage === "setup" && (
                <>
                  <Field label="Choose a demo photo">
                    <div className="brand-photo-options">
                      {["leo", "maya", "emma"].map((id) => (
                        <button
                          key={id}
                          aria-label={`Choose ${id} demo portrait`}
                          aria-pressed={photo === id}
                          onClick={() => setPhoto(id)}
                        >
                          <img
                            src={`/images/${id}.png`}
                            alt="Fictional demo portrait"
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
                    Read sample privacy & community principles
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
              {issue && (
                <p className="form-error" role="alert">
                  {issue}
                </p>
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
        title={`${provider} sign-in preview`}
      >
        <div className="body-pad">
          <p>
            This is a simulation, not an OAuth consent screen. Continue as
            fictional Alex or cancel to return.
          </p>
          <Primary
            onClick={() => {
              setProvider("");
              finishIdentity();
            }}
          >
            Continue as demo Alex
          </Primary>
          <button className="text-action" onClick={() => setProvider("")}>
            Cancel
          </button>
        </div>
      </BottomSheet>
      <BottomSheet
        open={showTerms}
        onOpenChange={setShowTerms}
        title="Sample community & privacy principles"
      >
        <div className="body-pad">
          <p>
            Adults 18+ meet for friendship over meals. Respect boundaries and
            dietary needs. No harassment or unsolicited pitches.
          </p>
          <p>
            Your name, photo and introduction are public to other members; your
            email is private. This prototype stores no real account and sends no
            authentication data.
          </p>
          <p>
            These are design examples, not production Terms of Service or a
            privacy policy. Final legal documents, account deletion and
            reporting support are required before launch.
          </p>
          <Primary onClick={() => setShowTerms(false)}>Back to sign-up</Primary>
        </div>
      </BottomSheet>
    </div>
  );
}

export default function Prototype() {
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
  const [bookings, setBookings] = useState<Record<string, BookingState>>({});
  const [refunds, setRefunds] = useState<
    Record<string, "PENDING" | "REFUNDED" | "FAILED">
  >({});
  const [memberId, setMemberId] = useState("maya");
  const [intro, setIntro] = useState(
    "I’m new to London and would love to meet people over a relaxed dinner.",
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
  const [completed, setCompleted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [report, setReport] = useState("");
  const [scenarioPayment, setScenarioPayment] = useState(false);
  const [beforeDeadline, setBeforeDeadline] = useState(true);
  const [platformCancel, setPlatformCancel] = useState(false);
  const [hostDecision, setHostDecision] = useState<Record<string, string>>({});
  const current = meals.find((m) => m.id === selected) || meals[0];
  const join = states[current.id] || "NONE";
  const payment = payments[current.id] || "UNPAID";
  const booking = bookings[current.id] || current.booking;
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
    setMemberId(id);
    go("member");
  };
  const updateJoin = (state: JoinState) =>
    setStates((s) => ({ ...s, [current.id]: state }));
  const countUp = (mealId = current.id) => {
    setConfirmedChats((s) => ({ ...s, [mealId]: true }));
    setMeals((ms) =>
      ms.map((m) =>
        m.id === mealId && !m.members.includes("alex")
          ? {
              ...m,
              confirmed: Math.min(m.capacity, m.confirmed + 1),
              members: [...m.members, "alex"],
            }
          : m,
      ),
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
          `Demo: ${members[meal.host]?.name || "Your host"} approved your application.${next === "CONFIRMED" ? " Your group chat is ready." : " Confirm your seat with a demo payment."}`,
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
        const r = completePayment(join, payment, !scenarioPayment);
        updateJoin(r.join);
        setPayments((p) => ({ ...p, [current.id]: r.payment }));
        if (r.payment === "PAID") {
          if (payment !== "PAID") countUp();
          setBookings((b) => ({ ...b, [current.id]: "CONFIRMED" }));
          go("booking");
        } else
          setError(
            "Demo payment declined. Your seat is held. Turn off the failure example and try again.",
          );
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
    if (platformCancel)
      setBookings((b) => ({ ...b, [current.id]: "CANCELLED" }));
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
      title: draft.title,
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
      description: draft.description,
      host: "alex",
      members: ["alex"],
      x: 42,
      y: 38,
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
    direct: "Maya",
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
            <h1>Find your next table</h1>
            <p className="tagline">Meet new people over a meal.</p>
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
                <img
                  className="map-image"
                  src="/images/london-map.png"
                  alt="Illustrated map of central London; demonstration locations"
                />
                {groups.map((group) => (
                  <button
                    key={group.area}
                    className={`map-pin ${areaGroup?.area === group.area ? "active" : ""}`}
                    style={{ left: `${group.x}%`, top: `${group.y}%` }}
                    onClick={() => selectArea(group.area)}
                    aria-label={`${group.area}: ${group.meals.length} ${group.meals.length === 1 ? "meal" : "meals"}`}
                    aria-pressed={areaGroup?.area === group.area}
                  >
                    {group.meals.length}
                  </button>
                ))}
                <span className="map-key">Numbers = meals in each area</span>
                <span className="map-note">
                  Illustrative map · Demo locations
                </span>
                <button
                  className="map-locate"
                  onClick={() => {
                    selectArea("Soho");
                    notify(
                      "Showing central London. Location access is not needed.",
                    );
                  }}
                  aria-label="Show central London"
                >
                  <PaperPlaneIcon />
                </button>
              </div>
              <section className="map-preview" aria-label="Selected area meals">
                {featured && (
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
                <p className="demo-note">
                  Fictional meals · Reservations and payments are simulated.
                </p>
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
                  {current.confirmed} of {current.capacity} confirmed
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
                  <span>{members[id]?.name || "Alex"}</span>
                </button>
              ))}
              {current.confirmed < current.capacity && (
                <div className="open-seat">
                  <PersonIcon />
                  <span>Your seat?</span>
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
                      : "Reservation pending"}
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
              Demo restaurant · Google Maps opens the neighbourhood.
            </p>
            <h2>Keeping costs clear</h2>
            <div className="price-row">
              <span>Expected spend per person</span>
              <strong>
                £{current.min}–{current.max}
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
            <div className="demo-note">
              Demo only. No real booking or payment is made.
            </div>
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
            <small>Emma · Shared a meal in September · Demo reference</small>
          </div>
          <p className="muted">
            Fictional profile and sample reference. Background information is
            self-described.
          </p>
          {blocked && (
            <div className="notice">
              You have blocked this member. Private contact is disabled.
            </div>
          )}
          <button className="text-action" onClick={() => setSheet("report")}>
            Report or block this member
          </button>
          <Primary secondary onClick={back}>
            Back to the meal
          </Primary>
        </div>
      );
    }
    if (page === "apply")
      return (
        <div className="body-pad">
          <span className="eyebrow">A GOOD EVENING STARTS WITH HELLO</span>
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
          <Primary onClick={submitApplication}>
            Send request <ArrowRightIcon />
          </Primary>
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
                    : "Your request is withdrawn."}
          </h1>
          <p className="prose">
            {join === "PENDING"
              ? `${members[current.host]?.name || "Your host"} will review your introduction. We’ll let you know when there’s an update.`
              : join === "APPROVED_PAYMENT_PENDING"
                ? "Your host approved your request. Pay to confirm your seat; your demo seat is held for 30 minutes."
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
                    notify("Demo: application declined.");
                  }}
                >
                  Preview declined request
                </button>
              </div>
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
              <strong>Demo card •••• 4242</strong>
              <small>No real card details needed</small>
            </div>
            <CheckCircledIcon />
          </div>
          <div className="notice">
            <LockClosedIcon />
            <span>Demo payment only. You will not be charged.</span>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I accept this meal’s sample terms: full refund until 24 hours
              before the meal; no refund after that. Host cancellation or
              booking failure is refunded in full.
            </span>
          </label>
          <label className="check-row demo-option">
            <input
              type="checkbox"
              checked={scenarioPayment}
              onChange={(e) => setScenarioPayment(e.target.checked)}
            />
            <span>Preview a failed payment</span>
          </label>
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
              ? "Processing demo payment…"
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
                ? "The restaurant couldn’t confirm this slot. Choose a different time or cancel for a full refund."
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
                  ? "Confirmed · GRB-1023"
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
                <span>
                  Refund ·{" "}
                  {money(
                    refundAmount(
                      current.deposit,
                      beforeDeadline,
                      platformCancel,
                    ),
                  )}
                </span>
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
                disabled={!groupReady(current.capacity, current.confirmed)}
                onClick={() => {
                  setBookings((b) => ({ ...b, [current.id]: "CONFIRMED" }));
                  notify(
                    `Demo reservation confirmed for ${current.confirmed} people.`,
                  );
                }}
              >
                {booking === "CONFIRMED"
                  ? "Reconfirm demo reservation"
                  : `Confirm demo reservation for ${current.confirmed} people`}
              </Primary>
              <p className="muted">
                {groupReady(current.capacity, current.confirmed)
                  ? "Available slot selected. No real restaurant is contacted."
                  : "At least 3 confirmed guests are needed for a small group, or both guests for a table for two."}
              </p>
              <Primary secondary onClick={() => go("host")}>
                Manage guest list
              </Primary>
            </>
          )}
          {join === "CONFIRMED" && booking !== "FAILED" && (
            <Primary onClick={() => go("chat")}>
              Meet your table in chat <ChatBubbleIcon />
            </Primary>
          )}
          {booking === "FAILED" && join !== "CANCELLED" && (
            <Primary
              onClick={() => {
                setBookings((b) => ({ ...b, [current.id]: "CONFIRMED" }));
                setMeals((ms) =>
                  ms.map((m) =>
                    m.id === current.id ? { ...m, time: "19:30" } : m,
                  ),
                );
                notify(
                  "Demo: restaurant confirmed the alternative 19:30 slot.",
                );
              }}
            >
              Choose available slot · 19:30
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
          <button className="text-action" onClick={() => setSheet("scenarios")}>
            Explore demo outcomes
          </button>
          {completed && (
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
                      ? "Start a conversation or invite Maya to another meal."
                      : `${current.venue} · ${booking === "CONFIRMED" ? "Restaurant confirmed" : "Reservation pending"}`}
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
                {!direct && chatAccess === "read-only"
                  ? "ARCHIVE · DEMO CONVERSATION"
                  : "TODAY · DEMO CONVERSATION"}
              </p>
              <div className="chat-message">
                <Avatar id={direct ? "maya" : speaker} size={30} />
                <div>
                  <small>{direct ? "Maya" : members[speaker].name}</small>
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
                ? messages.direct || []
                : chatAccess === "read-only"
                  ? chatArchives[current.id] || messages[current.id] || []
                  : messages[current.id] || []
              ).map((text, i) => (
                <div className="chat-message own" key={i}>
                  <div>
                    <small>You</small>
                    <p>{text}</p>
                    <small>Sent · Demo</small>
                  </div>
                </div>
              ))}
              <p className="demo-note">
                Messages are simulated in this browser.
              </p>
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
              <fieldset className="venue-picker">
                <legend>Choose a restaurant</legend>
                {createVenues.map((v) => (
                  <button
                    key={v.name}
                    aria-pressed={draft.venue === v.name}
                    className={draft.venue === v.name ? "chosen" : ""}
                    onClick={() =>
                      updateSchedule({ venue: v.name, min: v.min, max: v.max })
                    }
                  >
                    <span className="venue-monogram">
                      <SewingPinIcon />
                    </span>
                    <span>
                      <strong>{v.name}</strong>
                      <small>
                        {v.area} · {v.cuisine}
                      </small>
                      <small>{v.note}</small>
                      <small>
                        £{v.min}–{v.max} per person
                      </small>
                    </span>
                    {draft.venue === v.name && <CheckCircledIcon />}
                  </button>
                ))}
              </fieldset>
              <ChoiceGroup
                label="People, including you"
                value={String(draft.capacity)}
                onChange={(v) => updateSchedule({ capacity: Number(v) })}
                options={[2, 3, 4, 5, 6].map((n) => [String(n), `${n} people`])}
              />
              <p className="muted">
                {draft.capacity - 1} guest{draft.capacity === 2 ? "" : "s"} +
                you · friendship-first, at every table size.
              </p>
              <div className="create-calendar">
                <DateChoices
                  creation
                  value={draft.date}
                  meals={[]}
                  onChange={(date) => updateSchedule({ date, time: "" })}
                />
              </div>
              <p className="muted">
                London time · demo availability 17 Oct–15 Nov 2026. Mondays are
                unavailable.
              </p>
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
              <p className="demo-note">
                Fictional restaurants and sample availability. A time selection
                does not hold a table.
              </p>
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
                    : "Demo payments only. Host payment is outside this demo."}
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
                <strong>Sample cancellation terms</strong>
                <p>
                  {draft.cost === "offline"
                    ? "No in-app payment to refund. Let the host know if plans change."
                    : "Full refund until 24 hours before the meal; no refund after that. If the host cancels or the reservation fails, all payments are refunded."}
                </p>
                <small>Illustrative terms for this demo meal.</small>
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
                    `${longDate(draft.date)} · ${draft.time} London time · ${draft.capacity} people including you`,
                    0,
                  ],
                  ["The company", draft.mood, draft.language, 1],
                  [
                    "Costs & reservation",
                    draft.cost === "menu"
                      ? `£${draft.min} fixed menu per person`
                      : `£${draft.min}–${draft.max} estimated per person`,
                    `£${createDueNow(draft)} after approval · ${draft.booking === "external" ? "Host reports already booked" : "Reservation pending"}`,
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
                <strong>Sample cancellation terms</strong>
                <p>
                  {draft.cost === "offline"
                    ? "No in-app payment to refund."
                    : "Full refund until 24 hours before the meal; no refund after that. Host cancellation or booking failure is refunded in full."}
                </p>
              </div>
              <p className="demo-note">
                Publishing invites applications. No real booking or charge is
                made. Guests join only after your approval and any required demo
                payment.
              </p>
              <label className="create-consent">
                <input
                  type="checkbox"
                  checked={draft.accepted}
                  onChange={(e) =>
                    setDraft({ ...draft, accepted: e.target.checked })
                  }
                />
                <span>
                  I’ve checked the arrangements and the sample cancellation
                  terms.
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
          <h1>Your next good evening.</h1>
          <Carousel
            ariaLabel="Meal categories"
            className="tab-carousel"
            contentClassName="tabs"
          >
            {["Upcoming", "Applications", "Hosting", "Past"].map((t) => (
              <button
                className={mealTab === t ? "selected" : ""}
                onClick={() => setMealTab(t)}
                key={t}
              >
                {t}
              </button>
            ))}
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
                <Primary secondary onClick={() => go("review")}>
                  {reviewed ? "View your feedback" : "Leave feedback"}
                </Primary>
              </div>
              <p className="muted">
                This completed meal is a fictional demo example.
              </p>
            </>
          ) : (
            <>
              {meals
                .filter((m) =>
                  mealTab === "Hosting"
                    ? m.owned
                    : mealTab === "Applications"
                      ? [
                          "PENDING",
                          "APPROVED_PAYMENT_PENDING",
                          "DECLINED",
                          "WITHDRAWN",
                        ].includes(states[m.id] || "")
                      : states[m.id] === "CONFIRMED" ||
                        states[m.id] === "CANCELLED",
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
                mealTab === "Hosting"
                  ? m.owned
                  : mealTab === "Applications"
                    ? [
                        "PENDING",
                        "APPROVED_PAYMENT_PENDING",
                        "DECLINED",
                        "WITHDRAWN",
                      ].includes(states[m.id] || "")
                    : states[m.id] === "CONFIRMED" ||
                      states[m.id] === "CANCELLED",
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
                        : `Pay £${m.deposit} to confirm your seat and unlock the meal group. No real charge is made.`}
                    </p>
                    {pending ? (
                      <div className="demo-next-step">
                        <small>TRY THE NEXT STEP · DEMO ONLY</small>
                        <p>
                          No need to wait for a real host in this prototype.
                        </p>
                        <Primary secondary onClick={() => approveMeal(m)}>
                          Preview host approval
                        </Primary>
                      </div>
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
                <Avatar id="maya" size={46} />
                <div>
                  <strong>Maya</strong>
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
                  Show the simulated approval banner. Your status always remains
                  in Inbox.
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
            <p className="demo-note">
              Saved for this visit only. These controls don’t enable device push
              or email notifications.
            </p>
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
              <strong>{blocked ? "1 member" : "None"}</strong>
            </div>
            {blocked && (
              <button
                className="text-action"
                onClick={() => {
                  setBlocked(false);
                  notify(
                    "Maya unblocked. Mutual connection rules still apply.",
                  );
                }}
              >
                Unblock Maya
              </button>
            )}
            <div className="settings-info-row">
              <span>App language</span>
              <strong>English</strong>
            </div>
            <small>
              More interface languages are planned. Conversation languages can
              be changed in your profile.
            </small>
          </section>
          <section>
            <h2>Account</h2>
            <p>Demo account · no real login credentials stored.</p>
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
            <small>Replaying the intro keeps your current demo session.</small>
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
            <p>{profile.work}</p>
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
            <Avatar id="maya" size={46} />
            <div>
              <strong>Maya</strong>
              <p>A little supper club · Thu 15 Oct</p>
            </div>
          </div>
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
                  onChange={(e) => setWants(e.target.checked)}
                />
                <span>
                  <strong>I’d like to share a table again</strong>
                  <small>Private unless you both choose this.</small>
                </span>
                <HeartIcon />
              </label>
              <p className="muted">
                References appear after both people submit, or after 7 days.
                Private feedback is separate.
              </p>
              <Primary
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
                <div className="demo-panel">
                  <span>DEMO PREVIEW</span>
                  <p>
                    Explore what happens when Maya also wants to meet again.
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
              )}
              {mutual && (
                <>
                  <div className="notice">
                    <HeartIcon />
                    <span>You and Maya both want to meet again.</span>
                  </div>
                  <Primary onClick={() => go("direct")}>
                    Say hello to Maya <ChatBubbleIcon />
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
              hosting
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
                            ? {
                                ...m,
                                confirmed: m.confirmed + 1,
                                members: [...m.members, "emma"],
                              }
                            : m,
                        ),
                      );
                    notify("Emma has been notified. Demo notification only.");
                  }}
                >
                  Approve <CheckIcon />
                </Primary>
              </div>
            ) : (
              <>
                <span className="status-tag">{hostDecision[current.id]}</span>
                {hostDecision[current.id].startsWith("Approved") && (
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
                            ? {
                                ...m,
                                confirmed: Math.min(
                                  m.capacity,
                                  m.confirmed + 1,
                                ),
                                members: [...m.members, "emma"],
                              }
                            : m,
                        ),
                      );
                      notify("Demo: Emma paid and confirmed her place.");
                    }}
                  >
                    Preview guest payment
                  </button>
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
      <div className="grab-app">
        <div className="demo-ribbon">
          INTERACTIVE DEMO · NO REAL BOOKINGS OR CHARGES
        </div>
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
                  const key = page === "direct" ? "direct" : current.id;
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
                const key = page === "direct" ? "direct" : current.id;
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
            <p className="demo-note">
              Choose a meal to see the restaurant, people and details.
            </p>
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
            <label className="check-row demo-option">
              <input
                type="checkbox"
                checked={!beforeDeadline}
                onChange={(e) => setBeforeDeadline(!e.target.checked)}
              />
              <span>Demo: preview after the deadline</span>
            </label>
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
            {join === "CONFIRMED" && (
              <Primary
                secondary
                onClick={() => {
                  setCompleted(true);
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
          title="Share a private concern"
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
                notify(
                  "Demo report recorded locally. No support team was contacted.",
                );
              }}
            >
              Submit demo report
            </Primary>
            <button
              className="text-action danger"
              onClick={() => {
                setBlocked(true);
                setSheet("");
                notify("Member blocked in this demo.");
              }}
            >
              Block this member
            </button>
          </div>
        </BottomSheet>
        <BottomSheet
          open={sheet === "signout"}
          onOpenChange={(open) => !open && setSheet("")}
          title="Sign out of this demo?"
          snap={0.4}
        >
          <div className="sheet-body">
            <p>
              You’ll return to the account screen. Demo data remains in this
              browser until refresh or Reset demo.
            </p>
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
                setRefunds({});
                setMessages({});
                setPreferences({ mealUpdates: true, messagePreviews: true });
                setReviewed(false);
                setMutual(false);
                setWants(false);
                setReview("");
                setBlocked(false);
                setHostDecision({});
                setDraft(initialDraft);
                setChatText("");
                setIntro(
                  "I’m new to London and would love to meet people over a relaxed dinner.",
                );
                setScenarioPayment(false);
                setCompleted(false);
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
