import { useState, useMemo, useCallback } from "react";
import { useCsvData } from "@/context/CsvDataContext";
import type { TreeRecord } from "@/context/CsvDataContext";
import {
  Search, Plus, Pencil, Trash2, Download, ChevronLeft, ChevronRight,
  DatabaseZap, TreePine, Ruler, BarChart2, X, AlertTriangle, Info,
  Sprout, CalendarDays, RefreshCw,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

const MONTH_NUM: Record<string, number> = {
  Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,
  Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12,
};

/** Known species → suggested nickname (first 3+3 chars of genus+epithet) */
const SPECIES_NICKNAME: Record<string, string> = {
  "Acer campestre":         "AceCam",
  "Acer pseudoplatanus":    "AcePse",
  "Carpinus betulus":       "CarBet",
  "Fagus sylvatica":        "FagSyl",
  "Larix decidua":          "LarDec",
  "Picea abies":            "PicAbi",
  "Pinus sylvestris":       "PinSyl",
  "Prunus avium":           "PruAvi",
  "Pseudotsuga menziesii":  "PseMen",
  "Quercus petraea":        "QuePet",
  "Salix caprea":           "SalCap",
};

/** Derive a nickname from any species string (Gen3 + Epi3, title-cased) */
function autoNickname(species: string): string {
  if (SPECIES_NICKNAME[species]) return SPECIES_NICKNAME[species];
  const parts = species.trim().split(/\s+/);
  const g = parts[0] ?? "";
  const e = parts[1] ?? "";
  return (
    g.slice(0, 3).replace(/^./, (c) => c.toUpperCase()) +
    e.slice(0, 3).replace(/^./, (c) => c.toUpperCase())
  );
}

const BADGE_COLORS = [
  "bg-emerald-100 text-emerald-800",
  "bg-blue-100 text-blue-800",
  "bg-amber-100 text-amber-800",
  "bg-orange-100 text-orange-800",
  "bg-purple-100 text-purple-800",
  "bg-cyan-100 text-cyan-800",
  "bg-rose-100 text-rose-800",
  "bg-lime-100 text-lime-800",
  "bg-violet-100 text-violet-800",
  "bg-teal-100 text-teal-800",
  "bg-pink-100 text-pink-800",
  "bg-yellow-100 text-yellow-800",
];

const speciesBadgeCache: Record<string, string> = {};
function getBadgeColor(species: string): string {
  if (!speciesBadgeCache[species]) {
    const idx = Math.abs(
      [...species].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0),
    ) % BADGE_COLORS.length;
    speciesBadgeCache[species] = BADGE_COLORS[idx];
  }
  return speciesBadgeCache[species];
}
function SpeciesBadge({ species }: { species: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getBadgeColor(species)}`}>
      {species}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  // Tree ID parts (composed into Tree_ID)
  nickname:    string;   // e.g. AceCam  (auto-suggested, user can override)
  sector:      string;   // e.g. BR01
  speciesNum:  string;   // e.g. 1
  treeNum:     string;   // e.g. 1

  // Species
  species:     string;   // selected from dropdown or "custom"
  customSpecies: string; // filled when species === "__custom__"

  // Scan date
  month:       string;
  year:        string;

  // Location
  latitude:    string;
  longitude:   string;

  // Measurements
  height:      string;
  crownDiam:   string;
  biomass:     string;
}

const BLANK: FormState = {
  nickname: "", sector: "", speciesNum: "", treeNum: "",
  species: "", customSpecies: "",
  month: "Jun", year: "2019",
  latitude: "", longitude: "",
  height: "", crownDiam: "", biomass: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function composeTreeId(f: FormState): string {
  return `${f.nickname}_${f.sector}_${f.speciesNum}_${f.treeNum}`;
}

function resolveSpecies(f: FormState): string {
  return f.species === "__custom__" ? f.customSpecies.trim() : f.species;
}

function deriveFields(
  species: string,
  trees: TreeRecord[],
  excludeTreeId?: string,
): Pick<TreeRecord, "CrownAreaConvex" | "CrownAreaConcave" | "CrownBaseHeight" | "Predicted_DBH"> {
  const peers = trees.filter(
    (t) => t.Species === species && t.Tree_ID !== excludeTreeId,
  );
  const avg = (key: keyof TreeRecord) =>
    peers.length
      ? peers.reduce((s, t) => s + (t[key] as number), 0) / peers.length
      : 0;
  return {
    CrownAreaConvex:  +avg("CrownAreaConvex").toFixed(3),
    CrownAreaConcave: +avg("CrownAreaConcave").toFixed(3),
    CrownBaseHeight:  +avg("CrownBaseHeight").toFixed(3),
    Predicted_DBH:    +avg("Predicted_DBH").toFixed(3),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function validate(
  f: FormState,
  trees: TreeRecord[],
  mode: "add" | "edit",
  editOriginal: TreeRecord | null,
): string[] {
  const errors: string[] = [];

  // ── Tree ID parts ──
  if (!f.nickname.trim())                         errors.push("Species nickname is required (e.g. AceCam).");
  else if (!/^[A-Za-z]{3,8}$/.test(f.nickname.trim()))
                                                  errors.push("Nickname must be 3–8 letters only (e.g. AceCam).");
  if (!f.sector.trim())                           errors.push("Sector / Plot is required (e.g. BR01).");
  else if (!/^[A-Za-z0-9]{2,10}$/.test(f.sector.trim()))
                                                  errors.push("Sector must be 2–10 alphanumeric characters (e.g. BR01).");
  if (!f.speciesNum.trim())                       errors.push("Species number is required.");
  else if (!/^\d+$/.test(f.speciesNum.trim()) || +f.speciesNum <= 0)
                                                  errors.push("Species number must be a positive integer.");
  if (!f.treeNum.trim())                          errors.push("Tree number is required.");
  else if (!/^\d+$/.test(f.treeNum.trim()) || +f.treeNum <= 0)
                                                  errors.push("Tree number must be a positive integer.");

  // ── Species ──
  const sp = resolveSpecies(f);
  if (!sp)                                        errors.push("Species is required.");
  else if (sp.length < 3)                         errors.push("Species name must be at least 3 characters.");

  // ── Year ──
  const yr = parseInt(f.year, 10);
  if (!f.year || isNaN(yr))                       errors.push("Year is required.");
  else if (yr < 2000 || yr > 2100)                errors.push("Year must be between 2000 and 2100.");

  // ── Location ──
  const lat = parseFloat(f.latitude);
  const lng = parseFloat(f.longitude);
  if (f.latitude === "")                          errors.push("Latitude is required.");
  else if (isNaN(lat) || lat < -90 || lat > 90)   errors.push("Latitude must be a number between −90 and 90.");
  if (f.longitude === "")                         errors.push("Longitude is required.");
  else if (isNaN(lng) || lng < -180 || lng > 180) errors.push("Longitude must be a number between −180 and 180.");

  // ── Measurements ──
  const h  = parseFloat(f.height);
  const cd = parseFloat(f.crownDiam);
  const bm = parseFloat(f.biomass);

  if (f.height === "")                            errors.push("Height is required.");
  else if (isNaN(h) || h <= 0)                    errors.push("Height must be a positive number.");
  else if (h > 150)                               errors.push("Height cannot exceed 150 m — please check your value.");

  if (f.crownDiam === "")                         errors.push("Crown Diameter is required.");
  else if (isNaN(cd) || cd < 0)                   errors.push("Crown Diameter must be 0 or greater.");
  else if (cd > 50)                               errors.push("Crown Diameter cannot exceed 50 m — please check your value.");

  if (f.biomass === "")                           errors.push("Biomass is required.");
  else if (isNaN(bm) || bm <= 0)                  errors.push("Biomass must be a positive number.");

  // ── Duplicate check (only if ID parts are valid so far) ──
  if (errors.length === 0 || errors.every(e => e.startsWith("Height") || e.startsWith("Crown") || e.startsWith("Biomass") || e.startsWith("Latitude") || e.startsWith("Longitude"))) {
    const treeId = composeTreeId(f).replace(/\s/g, "");
    const month  = f.month;

    if (mode === "add") {
      const dup = trees.some(
        (t) => t.Tree_ID === treeId && t.Month === month,
      );
      if (dup)
        errors.push(
          `A record for Tree ID "${treeId}" in month "${month}" already exists. Each tree can have only one entry per month.`,
        );
    } else if (mode === "edit" && editOriginal) {
      // If the user changed the month, make sure new month doesn't conflict
      const movedMonth = month !== editOriginal.Month;
      if (movedMonth) {
        const dup = trees.some(
          (t) =>
            t.Tree_ID === treeId &&
            t.Month   === month  &&
            !(t.Tree_ID === editOriginal.Tree_ID && t.Month === editOriginal.Month),
        );
        if (dup)
          errors.push(
            `Tree "${treeId}" already has a record for "${month}". Each tree can have only one entry per month.`,
          );
      }
    }
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="stat-card flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: color }}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-display font-bold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM FIELD HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label, required, children, hint,
}: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const selectCls =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-primary/40";

// ─────────────────────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface ModalProps {
  mode: "add" | "edit";
  form: FormState;
  errors: string[];
  allSpecies: string[];
  derived: ReturnType<typeof deriveFields>;
  editOriginal: TreeRecord | null;
  onClose: () => void;
  onSave: () => void;
  onChange: <K extends keyof FormState>(field: K, value: string) => void;
}

function RecordModal({
  mode, form, errors, allSpecies, derived, editOriginal,
  onClose, onSave, onChange,
}: ModalProps) {
  const composedId = composeTreeId(form);
  const resolvedSp = resolveSpecies(form);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <TreePine className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-foreground">
                {mode === "add" ? "Add New Tree Record" : "Edit Tree Record"}
              </h2>
              {mode === "edit" && editOriginal && (
                <p className="text-xs text-muted-foreground font-mono">{editOriginal.Tree_ID}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="rounded-xl bg-destructive/8 border border-destructive/25 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm mb-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Please fix the following issues:
              </div>
              {errors.map((e, i) => (
                <p key={i} className="text-sm text-destructive pl-6">• {e}</p>
              ))}
            </div>
          )}

          {/* ── Section 1: Tree Identity ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tree Identity
              </p>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Composed ID preview */}
            <div className="rounded-xl bg-muted/40 border border-dashed border-border px-4 py-2.5 flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Composed Tree ID: </span>
              <span className="text-sm font-mono font-semibold text-foreground">{composedId || "—"}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Species dropdown */}
              <div className="col-span-2">
                <Field label="Species" required hint="Select from list or choose 'Add new species…' to enter a custom one">
                  <select
                    className={selectCls}
                    value={form.species}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange("species", val);
                      // Auto-fill nickname when known species selected
                      if (val && val !== "__custom__") {
                        const nick = autoNickname(val);
                        onChange("nickname", nick);
                      }
                    }}
                  >
                    <option value="">— Select species —</option>
                    {allSpecies.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="__custom__">＋ Add new species…</option>
                  </select>
                </Field>
              </div>

              {form.species === "__custom__" && (
                <div className="col-span-2">
                  <Field label="New Species Name" required hint="Enter full scientific name e.g. Betula pubescens">
                    <input
                      className={inputCls}
                      placeholder="e.g. Betula pubescens"
                      value={form.customSpecies}
                      onChange={(e) => {
                        onChange("customSpecies", e.target.value);
                        const nick = autoNickname(e.target.value);
                        onChange("nickname", nick);
                      }}
                    />
                  </Field>
                </div>
              )}

              {/* Nickname */}
              <Field
                label="Species Nickname"
                required
                hint="3–8 letters, auto-filled from species (e.g. AceCam). You can override."
              >
                <input
                  className={inputCls}
                  placeholder="e.g. AceCam"
                  value={form.nickname}
                  onChange={(e) => onChange("nickname", e.target.value)}
                />
              </Field>

              {/* Sector */}
              <Field
                label="Sector / Plot"
                required
                hint="Plot or area code (e.g. BR01, BR02, PLOT03)"
              >
                <input
                  className={inputCls}
                  placeholder="e.g. BR01"
                  value={form.sector}
                  onChange={(e) => onChange("sector", e.target.value.toUpperCase())}
                />
              </Field>

              {/* Species # */}
              <Field label="Species Number" required hint="Unique number for this species group">
                <input
                  type="number"
                  min="1"
                  className={inputCls}
                  placeholder="e.g. 1"
                  value={form.speciesNum}
                  onChange={(e) => onChange("speciesNum", e.target.value)}
                />
              </Field>

              {/* Tree # */}
              <Field label="Tree Number" required hint="Unique tree number within its species group">
                <input
                  type="number"
                  min="1"
                  className={inputCls}
                  placeholder="e.g. 1"
                  value={form.treeNum}
                  onChange={(e) => onChange("treeNum", e.target.value)}
                />
              </Field>
            </div>
          </section>

          {/* ── Section 2: Scan Date ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Scan Date
              </p>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Month" required>
                <select
                  className={selectCls}
                  value={form.month}
                  onChange={(e) => onChange("month", e.target.value)}
                >
                  {MONTHS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Year" required hint="2000–2100">
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  className={inputCls}
                  value={form.year}
                  onChange={(e) => onChange("year", e.target.value)}
                />
              </Field>
            </div>
          </section>

          {/* ── Section 3: Location ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                GPS Coordinates
              </p>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" required hint="−90 to 90">
                <input
                  type="number"
                  step="any"
                  className={inputCls}
                  placeholder="e.g. 49.013434"
                  value={form.latitude}
                  onChange={(e) => onChange("latitude", e.target.value)}
                />
              </Field>
              <Field label="Longitude" required hint="−180 to 180">
                <input
                  type="number"
                  step="any"
                  className={inputCls}
                  placeholder="e.g. 8.682752"
                  value={form.longitude}
                  onChange={(e) => onChange("longitude", e.target.value)}
                />
              </Field>
            </div>
          </section>

          {/* ── Section 4: Measurements ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Measurements
              </p>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Height (m)" required hint="0–150 m">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="150"
                  className={inputCls}
                  placeholder="e.g. 28.5"
                  value={form.height}
                  onChange={(e) => onChange("height", e.target.value)}
                />
              </Field>
              <Field label="Crown Diam. (m)" required hint="0–50 m">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="50"
                  className={inputCls}
                  placeholder="e.g. 8.2"
                  value={form.crownDiam}
                  onChange={(e) => onChange("crownDiam", e.target.value)}
                />
              </Field>
              <Field label="Biomass (kg)" required hint="> 0">
                <input
                  type="number"
                  step="any"
                  min="0"
                  className={inputCls}
                  placeholder="e.g. 1540.0"
                  value={form.biomass}
                  onChange={(e) => onChange("biomass", e.target.value)}
                />
              </Field>
            </div>
          </section>

          {/* ── Section 5: Auto-calculated ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Auto-calculated
              </p>
              <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                Species averages from dataset
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Crown Area Convex (m²)", value: derived.CrownAreaConvex },
                { label: "Crown Area Concave (m²)", value: derived.CrownAreaConcave },
                { label: "Crown Base Height (m)", value: derived.CrownBaseHeight },
                { label: "Predicted DBH (cm)", value: derived.Predicted_DBH },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <label className="block text-xs font-medium text-muted-foreground">{label}</label>
                  <div className="w-full rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    {resolvedSp ? value.toFixed(3) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/10 rounded-b-2xl shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-6 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {mode === "add" ? "Add Record" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM DELETE
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmDialog({
  title, description, treeId, rowCount, confirmLabel, onConfirm, onCancel,
}: {
  title: string;
  description: string;
  treeId: string;
  rowCount: number;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {description}{" "}
              {rowCount > 1 && (
                <span className="font-semibold text-foreground">
                  ({rowCount} scan records will be removed)
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="bg-muted/40 rounded-xl px-4 py-3 text-sm font-mono text-foreground break-all">
          {treeId}
        </div>
        <p className="text-xs text-muted-foreground">
          ⚠️ All pages (Overview, Spatial Map, Forest Change, etc.) will immediately reflect
          this change. This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

const DataManagerPage = () => {
  const { trees, addRecord, updateRecord, deleteScan, deleteTree, resetToOriginal } =
    useCsvData() as any;

  // ── Filter / search state ────────────────────────────────────────────────
  const [query,         setQuery]         = useState("");
  const [filterSpecies, setFilterSpecies] = useState("All");
  const [filterYear,    setFilterYear]    = useState("All");
  const [filterSector,  setFilterSector]  = useState("All");

  // ── Pagination ───────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // ── Modal ────────────────────────────────────────────────────────────────
  const [modal,        setModal]        = useState<null | "add" | "edit">(null);
  const [editOriginal, setEditOriginal] = useState<TreeRecord | null>(null);
  const [form,         setForm]         = useState<FormState>(BLANK);
  const [formErrors,   setFormErrors]   = useState<string[]>([]);

  // ── Delete ───────────────────────────────────────────────────────────────
  // deleteTarget holds the specific scan row to remove (Tree_ID + Month + Year)
  // deleteTreeTarget holds a Tree_ID when user wants to wipe ALL scans for a tree
  const [deleteTarget,     setDeleteTarget]     = useState<{ treeId: string; month: string; year: number } | null>(null);
  const [deleteTreeTarget, setDeleteTreeTarget] = useState<string | null>(null);

  // ── Reset confirm ────────────────────────────────────────────────────────
  const [showReset, setShowReset] = useState(false);

  // ── Derived filter options ───────────────────────────────────────────────
  const allSpecies = useMemo(
    () => ([...new Set((trees as TreeRecord[]).map((t) => t.Species))] as string[]).sort(),
    [trees],
  );
  const allYears = useMemo(
    () => ([...new Set((trees as TreeRecord[]).map((t) => t.Year))] as number[]).sort(),
    [trees],
  );
  const allSectors = useMemo(
    () => ([...new Set((trees as TreeRecord[]).map((t) => t.Sector))] as string[]).sort(),
    [trees],
  );

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const t = trees as TreeRecord[];
    if (!t.length) return { totalRows: 0, uniqueTrees: 0, uniqueSpecies: 0, uniqueScans: 0, avgHeight: 0, avgDBH: 0 };
    const avg = (key: keyof TreeRecord) =>
      t.reduce((s, r) => s + (r[key] as number), 0) / t.length;
    return {
      totalRows:     t.length,
      uniqueTrees:   new Set(t.map((r) => r.Tree_ID)).size,
      uniqueSpecies: new Set(t.map((r) => r.Species)).size,
      uniqueScans:   new Set(t.map((r) => `${r.Month}-${r.Year}`)).size,
      avgHeight:     +avg("Height").toFixed(2),
      avgDBH:        +avg("Predicted_DBH").toFixed(2),
    };
  }, [trees]);

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return (trees as TreeRecord[]).filter((t) => {
      if (filterSpecies !== "All" && t.Species !== filterSpecies) return false;
      if (filterYear    !== "All" && t.Year    !== parseInt(filterYear)) return false;
      if (filterSector  !== "All" && t.Sector  !== filterSector) return false;
      if (q &&
        !t.Tree_ID.toLowerCase().includes(q) &&
        !t.Species.toLowerCase().includes(q)  &&
        !t.Month.toLowerCase().includes(q)    &&
        !t.Sector.toLowerCase().includes(q))  return false;
      return true;
    });
  }, [trees, query, filterSpecies, filterYear, filterSector]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetPage = useCallback(() => setPage(1), []);

  // ── Derived fields for modal ─────────────────────────────────────────────
  const derived = useMemo(
    () => deriveFields(resolveSpecies(form), trees, editOriginal?.Tree_ID),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.species, form.customSpecies, trees, editOriginal],
  );

  // ── Open Add ─────────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(BLANK);
    setFormErrors([]);
    setEditOriginal(null);
    setModal("add");
  };

  // ── Open Edit ────────────────────────────────────────────────────────────
  const openEdit = (row: TreeRecord) => {
    const parts = row.Tree_ID.split("_");
    // parts: [nickname, sector, speciesNum, treeNum]
    setForm({
      nickname:      parts[0] ?? "",
      sector:        parts[1] ?? "",
      speciesNum:    parts[2] ?? "",
      treeNum:       parts[3] ?? "",
      species:       allSpecies.includes(row.Species) ? row.Species : "__custom__",
      customSpecies: allSpecies.includes(row.Species) ? "" : row.Species,
      month:         row.Month,
      year:          String(row.Year),
      latitude:      String(row.Latitude),
      longitude:     String(row.Longitude),
      height:        String(row.Height),
      crownDiam:     String(row.CrownDiameter),
      biomass:       String(row.Biomass_kg),
    });
    setFormErrors([]);
    setEditOriginal(row);
    setModal("edit");
  };

  // ── Handle field change ──────────────────────────────────────────────────
  const handleChange = useCallback(
    <K extends keyof FormState>(field: K, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setFormErrors([]);
    },
    [],
  );

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = () => {
    const errs = validate(form, trees, modal!, editOriginal);
    if (errs.length > 0) { setFormErrors(errs); return; }

    const treeId     = composeTreeId(form).replace(/\s/g, "");
    const sp         = resolveSpecies(form);
    const parts      = treeId.split("_");
    const sector     = parts[1] ?? "Unknown";
    const yr         = parseInt(form.year);
    const derived_   = deriveFields(sp, trees, editOriginal?.Tree_ID);

    const record: TreeRecord = {
      Tree_ID:          treeId,
      Species:          sp,
      Latitude:         parseFloat(form.latitude),
      Longitude:        parseFloat(form.longitude),
      Month:            form.month,
      Year:             yr,
      Height:           parseFloat(form.height),
      CrownDiameter:    parseFloat(form.crownDiam),
      Biomass_kg:       parseFloat(form.biomass),
      CrownAreaConvex:  derived_.CrownAreaConvex,
      CrownAreaConcave: derived_.CrownAreaConcave,
      CrownBaseHeight:  derived_.CrownBaseHeight,
      Predicted_DBH:    derived_.Predicted_DBH,
      Sector:           sector,
      Date:             new Date(yr, (MONTH_NUM[form.month] ?? 1) - 1, 15),
    };

    if (modal === "add") {
      addRecord(record);
    } else {
      // Pass the ORIGINAL key so updateRecord can find the right row even if Tree_ID changed
      updateRecord(record, {
        Tree_ID: editOriginal!.Tree_ID,
        Month:   editOriginal!.Month,
        Year:    editOriginal!.Year,
      });
    }

    setModal(null);
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const deleteTreeRowCount = useMemo(
    () => (deleteTreeTarget ? (trees as TreeRecord[]).filter((t) => t.Tree_ID === deleteTreeTarget).length : 0),
    [deleteTreeTarget, trees],
  );

  const handleDeleteScan = () => {
    if (deleteTarget) deleteScan(deleteTarget.treeId, deleteTarget.month, deleteTarget.year);
    setDeleteTarget(null);
  };

  const handleDeleteTree = () => {
    if (deleteTreeTarget) deleteTree(deleteTreeTarget);
    setDeleteTreeTarget(null);
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCsv = () => {
    const cols: (keyof TreeRecord)[] = [
      "Tree_ID","Species","Latitude","Longitude","Month","Year",
      "Height","CrownDiameter","CrownAreaConvex","CrownAreaConcave",
      "CrownBaseHeight","Predicted_DBH","Biomass_kg",
    ];
    const rows = [
      cols.join(","),
      ...filtered.map((t) => cols.map((c) => t[c]).join(",")),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "forest_data_export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const hasFilters =
    query || filterSpecies !== "All" || filterYear !== "All" || filterSector !== "All";

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground"> Data Manager</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Central control panel — add, edit or delete tree records. All changes sync instantly
            across Overview, Spatial Map, and every other analysis page.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReset(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors text-muted-foreground"
            title="Reset all data to original CSV"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Record
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={DatabaseZap} label="Total Scan Rows"   value={stats.totalRows.toLocaleString()}    color="hsl(152,45%,32%)" />
        <StatCard icon={TreePine}    label="Unique Trees"      value={stats.uniqueTrees.toLocaleString()}  color="hsl(210,60%,50%)" />
        <StatCard icon={Sprout}      label="Species"           value={stats.uniqueSpecies.toLocaleString()} color="hsl(38,75%,45%)" />
        <StatCard icon={CalendarDays} label="Scan Dates"       value={stats.uniqueScans.toLocaleString()}  color="hsl(280,45%,50%)" />
        <StatCard icon={Ruler}       label="Avg Height (m)"   value={String(stats.avgHeight)}             color="hsl(0,60%,50%)"   />
        <StatCard icon={BarChart2}   label="Avg DBH (cm)"     value={String(stats.avgDBH)}               color="hsl(152,55%,38%)" />
      </div>

      {/* ── Search & Filters ── */}
      <div className="stat-card space-y-3">
        <div className="flex flex-wrap gap-3 items-end">

          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Search Tree ID, Species, Sector, Month…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); resetPage(); }}
            />
          </div>

          {/* Species */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Species</label>
            <select
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={filterSpecies}
              onChange={(e) => { setFilterSpecies(e.target.value); resetPage(); }}
            >
              <option>All</option>
              {allSpecies.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Year */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Year</label>
            <select
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={filterYear}
              onChange={(e) => { setFilterYear(e.target.value); resetPage(); }}
            >
              <option>All</option>
              {allYears.map((y) => <option key={y}>{y}</option>)}
            </select>
          </div>

          {/* Sector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Sector</label>
            <select
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={filterSector}
              onChange={(e) => { setFilterSector(e.target.value); resetPage(); }}
            >
              <option>All</option>
              {allSectors.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Export */}
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">{filtered.length.toLocaleString()}</span>
            {" "}of{" "}
            <span className="font-semibold text-foreground">{(trees as TreeRecord[]).length.toLocaleString()}</span>
            {" "}rows
          </p>
          {hasFilters && (
            <button
              onClick={() => {
                setQuery(""); setFilterSpecies("All");
                setFilterYear("All"); setFilterSector("All"); resetPage();
              }}
              className="text-xs text-primary underline underline-offset-2 hover:opacity-80"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="stat-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {[
                  "Tree ID", "Species", "Sector", "Month", "Year",
                  "Height (m)", "Crown Ø (m)", "DBH (cm)", "Biomass (kg)", "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-20 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <DatabaseZap className="h-8 w-8 opacity-20" />
                      <span>No records match your filters.</span>
                    </div>
                  </td>
                </tr>
              ) : pageRows.map((row, i) => (
                <tr
                  key={`${row.Tree_ID}-${row.Month}-${row.Year}-${i}`}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground whitespace-nowrap">
                    {row.Tree_ID}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <SpeciesBadge species={row.Species} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                    {row.Sector}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.Month}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.Year}</td>
                  <td className="px-4 py-2.5 tabular-nums">{row.Height.toFixed(2)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{row.CrownDiameter.toFixed(2)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{row.Predicted_DBH.toFixed(2)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{row.Biomass_kg.toFixed(1)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(row)}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                        title="Edit this scan record"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ treeId: row.Tree_ID, month: row.Month, year: row.Year })}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                        title="Delete this scan row only"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTreeTarget(row.Tree_ID)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                        title="Delete ALL scans for this tree"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Page <span className="font-semibold text-foreground">{page}</span> of{" "}
              <span className="font-semibold text-foreground">{totalPages}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pg: number;
                if (totalPages <= 7)         pg = i + 1;
                else if (page <= 4)          pg = i + 1;
                else if (page >= totalPages - 3) pg = totalPages - 6 + i;
                else                         pg = page - 3 + i;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      pg === page
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {pg}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal && (
        <RecordModal
          mode={modal}
          form={form}
          errors={formErrors}
          allSpecies={allSpecies}
          derived={derived}
          editOriginal={editOriginal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onChange={handleChange}
        />
      )}

      {/* Delete single scan row */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete This Scan?"
          description={`This removes only the ${deleteTarget.month} ${deleteTarget.year} scan record for tree:`}
          treeId={deleteTarget.treeId}
          rowCount={1}
          confirmLabel="Delete Scan"
          onConfirm={handleDeleteScan}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Delete entire tree (all scans) */}
      {deleteTreeTarget && (
        <ConfirmDialog
          title="Delete Entire Tree?"
          description="This permanently removes ALL scan records across every month for tree:"
          treeId={deleteTreeTarget}
          rowCount={deleteTreeRowCount}
          confirmLabel="Delete All Scans"
          onConfirm={handleDeleteTree}
          onCancel={() => setDeleteTreeTarget(null)}
        />
      )}

      {/* ── Reset Confirm ── */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setShowReset(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <RefreshCw className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-display font-bold text-foreground">Reset to Original Data?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This will discard all your edits, additions, and deletions and restore the
                  original 2109 records from the built-in dataset.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowReset(false)}
                className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { resetToOriginal(); setShowReset(false); }}
                className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors"
              >
                Reset Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataManagerPage;
