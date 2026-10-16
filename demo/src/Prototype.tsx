import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  ChatBubbleIcon,
  CheckIcon,
  ChevronDownIcon,
  Cross2Icon,
  GlobeIcon,
  HeartIcon,
  InfoCircledIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  PersonIcon,
  PlusIcon,
  ReaderIcon,
  PinLeftIcon,
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
} from "./mobile";
import {
  initialMeals,
  members,
  eligibleMeals,
  applyToMeal,
  approveApplication,
  completePayment,
  longDate,
  validateMeal,
  refundAmount,
  groupReady,
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
  | "direct";
type Sheet = "" | "filters" | "cancel" | "scenarios" | "report" | "reset";
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
function Avatar({
  id,
  onClick,
  size = 34,
}: {
  id: string;
  onClick?: () => void;
  size?: number;
}) {
  const m = members[id] || members.maya;
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

export default function Prototype() {
  const keyboard = useKeyboard();
  const insets = useKeyboardInsets();
  const [page, setPage] = useState<Page>("discover");
  const [history, setHistory] = useState<Page[]>([]);
  const [meals, setMeals] = useState<Meal[]>(initialMeals);
  const [selected, setSelected] = useState("supper");
  const [mode, setMode] = useState<"map" | "list">("map");
  const [filters, setFilters] = useState({
    date: "",
    budget: "",
    size: "",
    search: "",
  });
  const [sheet, setSheet] = useState<Sheet>("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [profile, setProfile] = useState({
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
  const activeCount =
    Number(Boolean(filters.date)) +
    Number(Boolean(filters.budget)) +
    Number(Boolean(filters.size)) +
    Number(Boolean(filters.search));
  const featured = matches.find((m) => m.id === selected) || matches[0];
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
    keyboard.hide();
    setError("");
    setSheet("");
    setHistory((h) => [...h, page]);
    setPage(to);
  };
  const root = (to: Page) => {
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
  const countUp = () =>
    setMeals((ms) =>
      ms.map((m) =>
        m.id === current.id
          ? {
              ...m,
              confirmed: Math.min(m.capacity, m.confirmed + 1),
              members: [...m.members, "alex"],
            }
          : m,
      ),
    );
  const submitApplication = () => {
    try {
      const next = applyToMeal(current, join, intro, profileComplete);
      updateJoin(next);
      go("status");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const approve = () => {
    try {
      const next = approveApplication(current, join);
      updateJoin(next);
      if (next === "CONFIRMED") countUp();
      notify("Demo: Maya approved your application.");
    } catch (e) {
      setError((e as Error).message);
    }
  };
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
    const issue = validateMeal(
      draft.title,
      draft.description,
      draft.capacity,
      draft.min,
      draft.max,
    );
    if (issue) {
      setError(issue);
      return;
    }
    const meal: Meal = {
      id: `created-${Date.now()}`,
      title: draft.title,
      venue: draft.venue,
      area: draft.venue === "The Little Table" ? "Soho" : "Covent Garden",
      date: draft.date,
      time: draft.time,
      capacity: draft.capacity,
      confirmed: 1,
      min: draft.min,
      max: draft.cost === "menu" ? draft.min : draft.max,
      deposit:
        draft.cost === "offline" ? 0 : draft.cost === "menu" ? draft.min : 10,
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
    };
    setMeals((ms) => [meal, ...ms]);
    setSelected(meal.id);
    setCreateStep(0);
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
        className="meal-photo"
        onClick={() => openMeal(m)}
        aria-label={`View ${m.title}`}
      >
        <img
          src="/images/restaurant.png"
          alt="A warm, leafy London restaurant"
        />
      </button>
      <div className="meal-copy">
        <h3>
          <button onClick={() => openMeal(m)}>{m.title}</button>
        </h3>
        <p>
          <PinLeftIcon />
          {m.area}
        </p>
        <p>
          <CalendarIcon />
          {longDate(m.date)} · {m.time}
        </p>
        <p>
          <span className="pound">£</span>
          {m.min === m.max ? money(m.min) : `${money(m.min)}–${m.max}`} per
          person
        </p>
        <p>
          <PersonIcon />
          {m.confirmed} of {m.capacity} confirmed
        </p>
        <div className="avatars">
          {m.members.slice(0, 3).map((id) => (
            <Avatar
              key={id}
              id={id}
              onClick={() => openMember(id)}
              size={compact ? 31 : 35}
            />
          ))}
        </div>
      </div>
      {!compact && (
        <>
          <p className="card-caption">
            Relaxed sharing plates in a cosy neighbourhood spot.
            <br />
            Good food, easy conversation.
          </p>
          <Primary onClick={() => openMeal(m)}>
            View meal <ArrowRightIcon />
          </Primary>
        </>
      )}
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
                onClick={() => setSheet("filters")}
                aria-label="Filter by date"
              >
                <CalendarIcon />
                {filters.date ? longDate(filters.date) : "Any date"}
                <ChevronDownIcon />
              </button>
              <button
                onClick={() => setSheet("filters")}
                aria-label="Filter by budget"
              >
                <span>£</span>
                {filters.budget ? `Up to £${filters.budget}` : "Budget"}
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
                onClick={() => setSheet("filters")}
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
                {matches.map((m) => (
                  <button
                    key={m.id}
                    className={`map-pin ${featured?.id === m.id ? "active" : ""}`}
                    style={{ left: `${m.x}%`, top: `${m.y}%` }}
                    onClick={() => setSelected(m.id)}
                    aria-label={`${m.area}: ${m.title}, table for ${m.capacity}`}
                    aria-pressed={featured?.id === m.id}
                  >
                    {m.capacity}
                  </button>
                ))}
                <span className="map-note">
                  Illustrative map · Demo locations
                </span>
                <button
                  className="map-locate"
                  onClick={() => {
                    setSelected("supper");
                    notify(
                      "Showing central London. Location access is not needed.",
                    );
                  }}
                  aria-label="Show central London"
                >
                  <PaperPlaneIcon />
                </button>
              </div>
              <div className="map-preview">
                <div className="sheet-grip" />
                {featured ? (
                  mealCard(featured)
                ) : (
                  <div className="empty">
                    <MagnifyingGlassIcon />
                    <h3>No tables match just yet</h3>
                    <p>Try another date or a wider budget.</p>
                    <Primary
                      onClick={() =>
                        setFilters({
                          date: "",
                          budget: "",
                          size: "",
                          search: "",
                        })
                      }
                    >
                      Clear filters
                    </Primary>
                  </div>
                )}
              </div>
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
                    <div className="list-foot">
                      <span className="pill">{m.mood}</span>
                      <button
                        onClick={() => openMeal(m)}
                        aria-label={`Open ${m.title}`}
                      >
                        <ArrowRightIcon />
                      </button>
                    </div>
                  </div>
                ))}
                {!matches.length && (
                  <div className="empty">
                    <h3>No meals found</h3>
                    <p>Change your filters to find another table.</p>
                    <Primary
                      onClick={() =>
                        setFilters({
                          date: "",
                          budget: "",
                          size: "",
                          search: "",
                        })
                      }
                    >
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
              <PinLeftIcon />
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
                ? "Menu fee paid in-app. Drinks are paid separately at the restaurant."
                : current.deposit
                  ? "Your deposit goes toward your bill. Pay the rest at the restaurant; everyone pays their own share."
                  : "No payment is due in the app. Everyone pays their own share at the restaurant."}
            </p>
            <div className="notice">
              <InfoCircledIcon />
              <span>
                Free cancellation until Thu 22 Oct, 19:00. After that, this
                meal’s deposit is non-refundable. A failed reservation receives
                a full refund.
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
              I accept this meal’s cancellation terms: full refund before Thu 22
              Oct, 19:00; no deposit refund after that. Booking failure is
              refunded in full.
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
                  ? (current.owned ? "Your table is taking shape." : "Your seat is ready.")
                  : "See you at the table."}
          </h1>
          <p className="prose">
            {join === "CANCELLED"
              ? "Your place has been released. Any eligible refund is shown below."
              : booking === "FAILED"
                ? "The restaurant couldn’t confirm this slot. Choose a different time or cancel for a full refund."
                : booking === "PENDING"
                  ? (current.owned ? "Check your confirmed guests, then finalise the restaurant reservation below." : "You have a confirmed seat. Your host is finalising the restaurant reservation.")
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
      const allowed = direct
        ? mutual && !blocked
        : join === "CONFIRMED" || current.owned;
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
              <p className="chat-date">TODAY · DEMO CONVERSATION</p>
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
              {(messages[direct ? "direct" : current.id] || []).map(
                (text, i) => (
                  <div className="chat-message own" key={i}>
                    <div>
                      <small>You</small>
                      <p>{text}</p>
                      <small>Sent · Demo</small>
                    </div>
                  </div>
                ),
              )}
              <p className="demo-note">
                Messages are simulated in this browser.
              </p>
            </>
          )}
        </div>
      );
    }
    if (page === "create")
      return (
        <div className="body-pad">
          <div className="step-progress">
            {["The basics", "The company", "The details"].map((s, i) => (
              <span key={s} className={i <= createStep ? "on" : ""}>
                {i + 1} · {s}
              </span>
            ))}
          </div>
          <h1>
            {createStep === 0
              ? "Make room for new faces."
              : createStep === 1
                ? "What’s the vibe?"
                : "A little clarity goes a long way."}
          </h1>
          <p className="prose">
            {createStep === 0
              ? "Pick a place, a time and a few seats. You count as one."
              : createStep === 1
                ? "Help your future table know what to expect."
                : "Set the costs and booking arrangements before publishing."}
          </p>
          {createStep === 0 && (
            <>
              <Field label="Restaurant">
                <select
                  value={draft.venue}
                  onChange={(e) =>
                    setDraft({ ...draft, venue: e.target.value })
                  }
                >
                  <option>The Little Table</option>
                  <option>Casa Evening</option>
                </select>
              </Field>
              <div className="form-grid">
                <Field label="Date">
                  <select
                    value={draft.date}
                    onChange={(e) =>
                      setDraft({ ...draft, date: e.target.value })
                    }
                  >
                    <option value="2026-10-23">Fri 23 Oct</option>
                    <option value="2026-10-24">Sat 24 Oct</option>
                  </select>
                </Field>
                <Field label="Available slot">
                  <select
                    value={draft.time}
                    onChange={(e) =>
                      setDraft({ ...draft, time: e.target.value })
                    }
                  >
                    <option>18:30</option>
                    <option>19:00</option>
                    <option>19:30</option>
                  </select>
                </Field>
              </div>
              <Field label="People, including you">
                <div className="size-options">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      aria-label={`Table for ${n} people`}
                      aria-pressed={draft.capacity === n}
                      className={draft.capacity === n ? "selected" : ""}
                      onClick={() => setDraft({ ...draft, capacity: n })}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Field>
              <p className="muted">
                Small tables, easy conversation. Tables for two are also
                available in this demo.
              </p>
              <Primary onClick={() => setCreateStep(1)}>
                Continue <ArrowRightIcon />
              </Primary>
            </>
          )}
          {createStep === 1 && (
            <>
              <Field label="Give your meal a name">
                <KeyboardInput
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  onBlur={() => keyboard.hide()}
                  placeholder="e.g. Friday dinner & new faces"
                  maxLength={80}
                />
              </Field>
              <Field label="What should people expect?">
                <KeyboardTextarea
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                  onBlur={() => keyboard.hide()}
                  rows={4}
                  maxLength={1000}
                  placeholder="A relaxed dinner, a shared interest, or simply good company…"
                />
              </Field>
              <Field label="Atmosphere">
                <select
                  value={draft.mood}
                  onChange={(e) => setDraft({ ...draft, mood: e.target.value })}
                >
                  <option>Easy conversation</option>
                  <option>Food discoveries</option>
                  <option>Travel & culture</option>
                </select>
              </Field>
              <Field label="Conversation language">
                <select
                  value={draft.language}
                  onChange={(e) =>
                    setDraft({ ...draft, language: e.target.value })
                  }
                >
                  <option>English</option>
                  <option>English & Mandarin</option>
                  <option>English & French</option>
                </select>
              </Field>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <Primary
                onClick={() => {
                  if (
                    draft.title.trim().length < 5 ||
                    draft.description.trim().length < 20
                  ) {
                    setError(
                      "Add a title of at least 5 characters and a description of at least 20 characters.",
                    );
                    return;
                  }
                  setError("");
                  keyboard.hide();
                  setCreateStep(2);
                }}
              >
                Continue <ArrowRightIcon />
              </Primary>
            </>
          )}
          {createStep === 2 && (
            <>
              <div className="form-grid">
                <Field label="Budget from (£)">
                  <KeyboardInput
                    type="number"
                    min={0}
                    value={draft.min}
                    onBlur={() => keyboard.hide()}
                    onChange={(e) =>
                      setDraft({ ...draft, min: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Budget to (£)">
                  <KeyboardInput
                    type="number"
                    min={draft.min}
                    value={draft.max}
                    onBlur={() => keyboard.hide()}
                    onChange={(e) =>
                      setDraft({ ...draft, max: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
              <Field label="How will people pay?">
                <select
                  value={draft.cost}
                  onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
                >
                  <option value="deposit">
                    £10 deposit, remainder at restaurant
                  </option>
                  <option value="menu">
                    Fixed menu, paid in-app (budget from)
                  </option>
                  <option value="offline">Pay own share at restaurant</option>
                </select>
              </Field>
              <Field label="Reservation">
                <select
                  value={draft.booking}
                  onChange={(e) =>
                    setDraft({ ...draft, booking: e.target.value })
                  }
                >
                  <option value="in-app">
                    Book in the app after guests confirm
                  </option>
                  <option value="external">
                    I have already booked externally
                  </option>
                </select>
              </Field>
              <div className="summary-box">
                <strong>{draft.title}</strong>
                <p>
                  {draft.venue} · {longDate(draft.date)} · {draft.time}
                </p>
                <p>
                  {draft.capacity} people including you · {draft.language}
                </p>
                <p>
                  {draft.cost === "offline"
                    ? "No prepayment"
                    : draft.cost === "menu"
                      ? `£${draft.min} fixed menu`
                      : "£10 deposit per person"}
                </p>
                <small>
                  Sample terms: full refund before Thu 22 Oct, 19:00; no deposit
                  refund after. Booking failure is refunded.
                </small>
              </div>
              <p className="demo-note">
                Publishing creates a fictional meal in this demo. No restaurant
                reservation is made.
              </p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <Primary onClick={publish}>
                Publish meal <PlusIcon />
              </Primary>
            </>
          )}
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
                      <button
                        aria-label={`Open ${m.title}`}
                        onClick={() => openMeal(m)}
                      >
                        <ArrowRightIcon />
                      </button>
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
    if (page === "inbox")
      return (
        <div className="body-pad">
          <div className="eyebrow">BEFORE AND AFTER THE TABLE</div>
          <h1>A little hello.</h1>
          <h2>Your conversations</h2>
          {meals
            .filter((m) => states[m.id] === "CONFIRMED" || m.owned)
            .map((m) => (
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
                  <p>Maya: Looking forward to meeting you!</p>
                  <small>{longDate(m.date)} · Meal group</small>
                </div>
                <ArrowRightIcon />
              </button>
            ))}
          {mutual && !blocked && (
            <button className="inbox-row" onClick={() => go("direct")}>
              <Avatar id="maya" size={46} />
              <div>
                <strong>Maya</strong>
                <p>You both want to meet again.</p>
              </div>
              <HeartIcon />
            </button>
          )}
          {!meals.some((m) => states[m.id] === "CONFIRMED" || m.owned) &&
            !mutual && (
              <div className="empty">
                <ChatBubbleIcon />
                <h2>Conversation starts at the table.</h2>
                <p>
                  Your meal group opens when your place is confirmed. Private
                  chats open by mutual choice.
                </p>
                <Primary secondary onClick={() => root("discover")}>
                  Find a meal
                </Primary>
              </div>
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
    if (page === "profile")
      return (
        <div className="body-pad">
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
          <div className="demo-panel">
            <span>ABOUT THIS DEMO</span>
            <p>
              Explore as Alex. All people, meals, payments and reservations are
              fictional. Changes reset on refresh.
            </p>
            <button className="text-action" onClick={() => setSheet("reset")}>
              Reset demo
            </button>
          </div>
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
    (page === "chat" && (join === "CONFIRMED" || current.owned)) ||
    (page === "direct" && mutual && !blocked);
  return (
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
          key={page}
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
        open={sheet === "filters"}
        onOpenChange={(o) => !o && setSheet("")}
        title="Find your kind of table"
        snap={0.8}
      >
        <div className="sheet-body">
          <Field label="Restaurant or neighbourhood">
            <KeyboardInput
              placeholder="Soho, ramen, a restaurant…"
              value={filters.search}
              onBlur={() => keyboard.hide()}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />
          </Field>
          <Field label="When">
            <select
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
            >
              <option value="">Any date</option>
              <option value="2026-10-23">Friday 23 October</option>
              <option value="2026-10-24">Saturday 24 October</option>
            </select>
          </Field>
          <Field label="Budget per person">
            <select
              value={filters.budget}
              onChange={(e) =>
                setFilters({ ...filters, budget: e.target.value })
              }
            >
              <option value="">Any budget</option>
              <option value="30">Up to £30</option>
              <option value="35">Up to £35</option>
              <option value="10">Up to £10 · empty example</option>
            </select>
          </Field>
          <Field label="Table size">
            <select
              value={filters.size}
              onChange={(e) => setFilters({ ...filters, size: e.target.value })}
            >
              <option value="">All tables</option>
              <option value="small">Small groups · 3–6 people</option>
              <option value="duo">A table for two</option>
            </select>
          </Field>
          <Primary
            onClick={() => {
              keyboard.hide();
              setSheet("");
            }}
          >
            Show {matches.length} {matches.length === 1 ? "meal" : "meals"}{" "}
            <ArrowRightIcon />
          </Primary>
          <button
            className="text-action"
            onClick={() =>
              setFilters({ date: "", budget: "", size: "", search: "" })
            }
          >
            Clear filters
          </button>
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
            Your seat at <strong>{current.title}</strong> will be released. The
            group chat becomes read-only.
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
        open={sheet === "reset"}
        onOpenChange={(o) => !o && setSheet("")}
        title="Start again?"
        snap={0.4}
      >
        <div className="sheet-body">
          <p>
            Demo applications, messages, created meals and profile edits will be
            cleared.
          </p>
          <Primary secondary onClick={() => setSheet("")}>
            Keep exploring
          </Primary>
          <button
            className="cancel-confirm"
            onClick={() => {
              setMeals(initialMeals);
              setStates({});
              setPayments({});
              setBookings({});
              setRefunds({});
              setMessages({});
              setReviewed(false);
              setMutual(false);
              setWants(false);
              setReview("");
              setBlocked(false);
              setHostDecision({});
              setDraft(initialDraft);
              setChatText("");
              setIntro("I’m new to London and would love to meet people over a relaxed dinner.");
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
              setFilters({ date: "", budget: "", size: "", search: "" });
              setSelected("supper");
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
  );
}
