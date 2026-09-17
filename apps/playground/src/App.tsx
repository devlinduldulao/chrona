import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, CalendarRange, Check, ChevronRight, Clock3, Code2, Copy, Eye, Layers, RotateCcw, SlidersHorizontal, TextCursorInput, Trash2 } from "lucide-react";
import { Calendar, ChronaProvider, DateField, DatePicker, RangeCalendar, TimeField } from "chrona-react";
import type { DateRange, HourCycle, PlainDate, PlainTime } from "chrona-core";

const components = [
    { name: "Calendar", icon: CalendarDays, type: "Temporal.PlainDate" },
    { name: "RangeCalendar", icon: CalendarRange, type: "{ start, end }" },
    { name: "DateField", icon: TextCursorInput, type: "Temporal.PlainDate" },
    { name: "TimeField", icon: Clock3, type: "Temporal.PlainTime" },
    { name: "DatePicker", icon: Layers, type: "Temporal.PlainDate" },
] as const;
type ComponentName = typeof components[number]["name"];
const reference = Temporal.PlainDate.from({ year: 2026, month: 9, day: 16 });
const studioImage = new URL("./studio.jpg", import.meta.url).href;

function Setting({ label, children }: { label: string; children: ReactNode }) {
    const id = useId();
    return <div className="setting"><label htmlFor={id}>{label}</label>{isValidElement(children) ? cloneElement(children as ReactElement<{ id: string }>, { id }) : children}</div>;
}

export function App({ engine, nativeAvailable }: { engine: "native" | "polyfill"; nativeAvailable: boolean }) {
    const [active, setActive] = useState<ComponentName>("Calendar");
    const [tab, setTab] = useState<"preview" | "api">("preview");
    const [locale, setLocale] = useState("en-US");
    const [calendar, setCalendar] = useState("iso8601");
    const [months, setMonths] = useState(1);
    const [fixedWeeks, setFixedWeeks] = useState(true);
    const [disabled, setDisabled] = useState(false);
    const [readOnly, setReadOnly] = useState(false);
    const [weekends, setWeekends] = useState(false);
    const [bounded, setBounded] = useState(false);
    const [hourCycle, setHourCycle] = useState<HourCycle>("h12");
    const [seconds, setSeconds] = useState(false);
    const [date, setDate] = useState<PlainDate | null>(reference);
    const [time, setTime] = useState<PlainTime | null>(Temporal.PlainTime.from({ hour: 9, minute: 30 }));
    const [range, setRange] = useState<DateRange | null>({ start: reference, end: reference.add({ days: 3 }) });
    const [events, setEvents] = useState<{ name: string; value: string }[]>([]);
    const [copied, setCopied] = useState(false);
    const [resetKey, setResetKey] = useState(0);
    const isGrid = active === "Calendar" || active === "RangeCalendar";
    const component = components.find((item) => item.name === active)!;
    const dir = locale === "ar-EG" ? "rtl" : "ltr";
    const serialized = active === "TimeField" ? time?.toString() ?? "null" : active === "RangeCalendar" ? range ? `{ "start": "${range.start.toString()}", "end": "${range.end.toString()}" }` : "null" : date?.toString() ?? "null";

    function record(name: string, value: string) { setEvents((previous) => [{ name, value }, ...previous].slice(0, 5)); setCopied(false); }
    function changeDate(value: PlainDate | null) { setDate(value); record("onChange", value?.toString() ?? "null"); }
    function changeTime(value: PlainTime | null) { setTime(value); record("onChange", value?.toString() ?? "null"); }
    function changeRange(value: DateRange | null) { setRange(value); record("onChange", value ? `${value.start.toString()} / ${value.end.toString()}` : "null"); }
    function reset() {
        setDate(reference); setTime(Temporal.PlainTime.from({ hour: 9, minute: 30 })); setRange({ start: reference, end: reference.add({ days: 3 }) });
        setEvents([]); setResetKey((value) => value + 1); setCopied(false);
    }

    const shared = { disabled, readOnly, minValue: bounded ? reference : undefined, maxValue: bounded ? reference.add({ months: 2 }) : undefined, isDateUnavailable: weekends ? (value: PlainDate) => value.dayOfWeek >= 6 : undefined };
    const gridOptions = { ...shared, fixedWeeks, numberOfMonths: months, pagedNavigation: true, calendar, placeholderValue: reference };
    const header = <Calendar.Header><Calendar.PrevButton title="Previous month"><ArrowLeft size={17} /></Calendar.PrevButton><Calendar.Heading /><Calendar.NextButton title="Next month"><ArrowRight size={17} /></Calendar.NextButton></Calendar.Header>;
    const grid = (index: number) => <Calendar.Grid key={index} monthIndex={index}>{months > 1 && <Calendar.Heading />}<Calendar.GridHeader /><Calendar.GridBody /></Calendar.Grid>;
    const source = `import { ${active} } from "chrona-react";\n\n<${active}.Root\n  value={value}\n  onChange={setValue}\n  locale="${locale}"${isGrid ? `\n  calendar="${calendar}"\n  fixedWeeks={${fixedWeeks}}` : ""}\n>\n${isGrid ? `  <${active}.Header>\n    <${active}.PrevButton />\n    <${active}.Heading />\n    <${active}.NextButton />\n  </${active}.Header>\n  <${active}.Grid>\n    <${active}.GridHeader />\n    <${active}.GridBody />\n  </${active}.Grid>` : `  <${active}.Label>Appointment</${active}.Label>\n  <${active}.Field />${active === "DatePicker" ? "\n  <DatePicker.Trigger />\n  <DatePicker.Popover>\n    <DatePicker.Calendar />\n  </DatePicker.Popover>" : ""}\n  <${active}.HiddenInput name="appointment" />`}\n</${active}.Root>`;

    return <div className="workbench">
        <aside className="sidebar">
            <a className="brand" href="/" aria-label="Chrona home"><span className="brand-mark"><Clock3 size={23} strokeWidth={1.7} /></span><span>chrona<span className="brand-dot">.</span></span></a>
            <div className="nav-section">PRIMITIVES <span>05</span></div>
            <nav aria-label="Components">{components.map(({ name, icon: Icon }) => <button key={name} type="button" title={name} aria-label={name} aria-current={active === name ? "page" : undefined} className={active === name ? "nav-item active" : "nav-item"} onClick={() => { setActive(name); setTab("preview"); setCopied(false); }}><Icon size={18} /><span>{name}</span>{active === name && <ChevronRight size={14} className="nav-arrow" />}</button>)}</nav>
            <div className="sidebar-bottom"><span className="release-dot" /><div><strong>0.1.0</strong><span>Experimental</span></div></div>
        </aside>

        <main>
            <header className="topbar"><div className="breadcrumb"><span>Workbench</span><ChevronRight size={13} /><strong>{active}</strong></div><label className="engine"><span className="engine-dot" /><span className="sr-only">Temporal engine</span><select aria-label="Temporal engine" value={engine} onChange={(event) => { location.search = `?temporal=${event.target.value}`; }}><option value="polyfill">Temporal polyfill</option><option value="native" disabled={!nativeAvailable}>Native Temporal</option></select></label></header>
            <section className="page-heading"><div><div className="package-name">chrona-react</div><h1>{active}</h1></div><span className="value-type">{component.type}</span></section>
            <div className="workspace-body">
                <section className="preview-column" aria-label="Component preview">
                    <div className="preview-toolbar"><div className="tabs" role="tablist" aria-label="Workbench view"><button type="button" role="tab" id="preview-tab" aria-controls="preview-panel" aria-selected={tab === "preview"} onClick={() => setTab("preview")}><Eye size={15} />Preview</button><button type="button" role="tab" id="api-tab" aria-controls="api-panel" aria-selected={tab === "api"} onClick={() => setTab("api")}><Code2 size={15} />API</button></div><button type="button" className="icon-button" title="Reset values" aria-label="Reset values" onClick={reset}><RotateCcw size={16} /></button></div>
                    {tab === "preview" ? <div role="tabpanel" id="preview-panel" aria-labelledby="preview-tab" className="preview-stage">
                        <div className="sample-context"><div><span className="sample-eyebrow">STUDIO NORTH</span><h2>{active === "RangeCalendar" ? "Reserve your dates" : "Plan your next session"}</h2><span className="sample-location">Copenhagen, Denmark</span></div><img src={studioImage} alt="A bright studio with shared work tables" width="110" height="82" /></div>
                        <div className={`component-canvas ${isGrid ? "grid-canvas" : "field-canvas"}`} key={`${active}-${resetKey}`}>
                            <ChronaProvider locale={locale} dir={dir} timeZone="Europe/Copenhagen">
                                {active === "Calendar" && <Calendar.Root {...gridOptions} value={date} onChange={changeDate}>
                                    {header}<div className="month-layout">{Array.from({ length: months }, (_, index) => grid(index))}</div><Calendar.LiveRegion className="sr-only" /><div className="calendar-footer"><span>{date ? date.withCalendar("gregory").toLocaleString(locale, { dateStyle: "medium" }) : "No date selected"}</span><Calendar.ClearButton title="Clear date" className="icon-button"><Trash2 size={15} /></Calendar.ClearButton></div>
                                </Calendar.Root>}
                                {active === "RangeCalendar" && <RangeCalendar.Root {...gridOptions} value={range} onChange={changeRange} onRangeStartChange={(value) => { if (value) record("onRangeStartChange", value.toString()); }} onInvalid={() => record("onInvalid", "Range includes unavailable dates")}>
                                    <RangeCalendar.Header><RangeCalendar.PrevButton title="Previous month"><ArrowLeft size={17} /></RangeCalendar.PrevButton><RangeCalendar.Heading /><RangeCalendar.NextButton title="Next month"><ArrowRight size={17} /></RangeCalendar.NextButton></RangeCalendar.Header>
                                    <div className="month-layout">{Array.from({ length: months }, (_, index) => <RangeCalendar.Grid key={index} monthIndex={index}>{months > 1 && <RangeCalendar.Heading />}<RangeCalendar.GridHeader /><RangeCalendar.GridBody /></RangeCalendar.Grid>)}</div><RangeCalendar.LiveRegion className="sr-only" /><div className="calendar-footer"><span>{range ? `${range.start.until(range.end).days + 1} days selected` : "No dates selected"}</span><RangeCalendar.ClearButton title="Clear range" className="icon-button"><Trash2 size={15} /></RangeCalendar.ClearButton></div>
                                </RangeCalendar.Root>}
                                {active === "DateField" && <DateField.Root {...shared} value={date?.withCalendar("iso8601") ?? null} onChange={changeDate} placeholderValue={reference}><DateField.Label>Session date</DateField.Label><DateField.Field /><DateField.HiddenInput name="session-date" /><DateField.ClearButton className="field-clear" title="Clear date"><Trash2 size={15} /></DateField.ClearButton></DateField.Root>}
                                {active === "TimeField" && <TimeField.Root value={time} onChange={changeTime} disabled={disabled} readOnly={readOnly} hourCycle={hourCycle} granularity={seconds ? "second" : "minute"}><TimeField.Label>Start time</TimeField.Label><TimeField.Field /><TimeField.HiddenInput name="session-time" /><TimeField.ClearButton className="field-clear" title="Clear time"><Trash2 size={15} /></TimeField.ClearButton></TimeField.Root>}
                                {active === "DatePicker" && <DatePicker.Root {...shared} fixedWeeks value={date?.withCalendar("iso8601") ?? null} onChange={changeDate} placeholderValue={reference} onOpenChange={(open) => record("onOpenChange", String(open))}><DatePicker.Label>Session date</DatePicker.Label><div className="picker-input"><DatePicker.Field /><DatePicker.Trigger title="Choose date"><CalendarDays size={18} /></DatePicker.Trigger></div><DatePicker.Popover><DatePicker.Calendar>{header}<Calendar.Grid><Calendar.GridHeader /><Calendar.GridBody /></Calendar.Grid></DatePicker.Calendar></DatePicker.Popover><DatePicker.HiddenInput name="session-date" /></DatePicker.Root>}
                            </ChronaProvider>
                        </div>
                        <div className="preview-caption"><span className="status-dot" />{disabled ? "Disabled" : readOnly ? "Read only" : "Interactive"}<span>{locale}<span className="caption-separator">/</span>{dir.toUpperCase()}</span></div>
                    </div> : <div role="tabpanel" id="api-panel" aria-labelledby="api-tab" className="source-panel"><pre><code>{source}</code></pre></div>}
                    <div className="value-panel"><div className="value-panel-heading"><span><span className="code-indicator">{`{ }`}</span> Value</span><button type="button" title={copied ? "Copied" : "Copy value"} aria-label={copied ? "Copied" : "Copy value"} onClick={async () => { await navigator.clipboard.writeText(serialized); setCopied(true); }}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></div><output data-testid="value-output">{serialized}</output></div>
                    <section className="event-section" aria-labelledby="events-heading"><div className="events-heading"><h2 id="events-heading">Events <span>{events.length}</span></h2><button type="button" className="icon-button" title="Clear events" aria-label="Clear events" onClick={() => setEvents([])}><Trash2 size={14} /></button></div><div className="event-list" aria-live="polite">{events.length ? events.map((event, index) => <div className="event-row" key={index}><span className="event-index">{String(events.length - index).padStart(2, "0")}</span><code>{event.name}</code><span>{event.value}</span></div>) : <div className="empty-events">No changes yet</div>}</div></section>
                </section>
                <aside className="inspector" aria-label="Configuration"><h2><SlidersHorizontal size={16} />Configuration</h2><div className="inspector-section"><span className="section-label">INTERNATIONALIZATION</span><Setting label="Locale"><select value={locale} onChange={(event) => setLocale(event.target.value)}><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="de-DE">Deutsch</option><option value="ja-JP">Japanese</option><option value="ar-EG">Arabic (Egypt)</option></select></Setting>{isGrid && <Setting label="Calendar system"><select value={calendar} onChange={(event) => { setCalendar(event.target.value); setResetKey((value) => value + 1); }}>{[["iso8601", "ISO 8601"], ["gregory", "Gregorian"], ["hebrew", "Hebrew"], ["japanese", "Japanese"], ["chinese", "Chinese"]].map(([value, label]) => {
                    let supported = true;
                    try { reference.withCalendar(value!).add({ days: 1 }); } catch { supported = false; }
                    return <option key={value} value={value} disabled={!supported}>{label}{supported ? "" : " (unavailable)"}</option>;
                })}</select></Setting>}{active === "TimeField" && <Setting label="Hour cycle"><select value={hourCycle} onChange={(event) => setHourCycle(event.target.value as HourCycle)}><option value="h12">12-hour (1-12)</option><option value="h23">24-hour (0-23)</option><option value="h11">12-hour (0-11)</option><option value="h24">24-hour (1-24)</option></select></Setting>}</div>
                    <div className="inspector-section"><span className="section-label">BEHAVIOR</span>{isGrid && <><Setting label="Visible months"><select value={months} onChange={(event) => setMonths(Number(event.target.value))}><option value="1">1 month</option><option value="2">2 months</option></select></Setting><label className="toggle-row"><span>Fixed weeks</span><input type="checkbox" checked={fixedWeeks} onChange={(event) => setFixedWeeks(event.target.checked)} /></label></>}{active === "TimeField" && <label className="toggle-row"><span>Show seconds</span><input type="checkbox" checked={seconds} onChange={(event) => setSeconds(event.target.checked)} /></label>}<label className="toggle-row"><span>Disabled</span><input type="checkbox" checked={disabled} onChange={(event) => setDisabled(event.target.checked)} /></label><label className="toggle-row"><span>Read only</span><input type="checkbox" checked={readOnly} onChange={(event) => setReadOnly(event.target.checked)} /></label></div>
                    {active !== "TimeField" && <div className="inspector-section"><span className="section-label">CONSTRAINTS</span><label className="toggle-row"><span>Weekends unavailable</span><input type="checkbox" checked={weekends} onChange={(event) => setWeekends(event.target.checked)} /></label><label className="toggle-row"><span>Limit to Sep 16 - Nov 16</span><input type="checkbox" checked={bounded} onChange={(event) => setBounded(event.target.checked)} /></label></div>}
                    <div className="inspector-meta"><span>PACKAGE</span><code>chrona-react</code><span>VALUE MODEL</span><code>{component.type}</code></div>
                </aside>
            </div>
            <footer className="app-footer"><span>Chrona <span className="footer-slash">/</span> Component workbench</span><span>v0.1.0</span></footer>
        </main>
    </div>;
}