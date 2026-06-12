import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/DatePicker';
import { lookupKey } from '@/lib/formatters';

// Empty PROXY_BASE → relative URLs (dashboard and form-proxy share the domain).
const PROXY_BASE = '';
const APP_ID = '6a2a945752aca730d81808a1';
const SUBMIT_PATH = `/rest/apps/${APP_ID}/records`;
const ALTCHA_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js';

async function submitPublicForm(fields: Record<string, unknown>, captchaToken: string) {
  const res = await fetch(`${PROXY_BASE}/api${SUBMIT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Captcha-Token': captchaToken,
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Submission failed');
  }
  return res.json();
}


function cleanFields(fields: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value) && 'key' in (value as any)) {
      cleaned[key] = (value as any).key;
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map(item =>
        typeof item === 'object' && item !== null && 'key' in item ? item.key : item
      );
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export default function PublicFormReparaturauftraege() {
  const [fields, setFields] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captchaRef = useRef<HTMLElement | null>(null);

  // Load the ALTCHA web component script once per page.
  useEffect(() => {
    if (document.querySelector(`script[src="${ALTCHA_SCRIPT_SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = ALTCHA_SCRIPT_SRC;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const prefill: Record<string, any> = {};
    params.forEach((value, key) => { prefill[key] = value; });
    if (Object.keys(prefill).length) setFields(prev => ({ ...prefill, ...prev }));
  }, []);

  function readCaptchaToken(): string | null {
    const el = captchaRef.current as any;
    if (!el) return null;
    return el.value || el.getAttribute('value') || null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = readCaptchaToken();
    if (!token) {
      setError('Bitte warte auf die Spam-Prüfung und versuche es erneut.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitPublicForm(cleanFields(fields), token);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Vielen Dank!</h2>
          <p className="text-muted-foreground">Deine Eingabe wurde erfolgreich übermittelt.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setSubmitted(false); setFields({}); }}>
            Weitere Eingabe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Reparaturaufträge — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
          <div className="space-y-2">
            <Label htmlFor="auftragsnummer">Auftragsnummer</Label>
            <Input
              id="auftragsnummer"
              placeholder=""
              value={fields.auftragsnummer ?? ''}
              onChange={e => setFields(f => ({ ...f, auftragsnummer: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eingangsdatum">Eingangsdatum</Label>
            <DatePicker
              id="eingangsdatum"
              placeholder=""
              mode="date"
              value={fields.eingangsdatum ?? null}
              onChange={v => setFields(f => ({ ...f, eingangsdatum: v ?? undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fahrzeug_bezeichnung">Fahrzeug / Gerät</Label>
            <Input
              id="fahrzeug_bezeichnung"
              placeholder=""
              value={fields.fahrzeug_bezeichnung ?? ''}
              onChange={e => setFields(f => ({ ...f, fahrzeug_bezeichnung: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kennzeichen">Kennzeichen / Seriennummer</Label>
            <Input
              id="kennzeichen"
              placeholder=""
              value={fields.kennzeichen ?? ''}
              onChange={e => setFields(f => ({ ...f, kennzeichen: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="problembeschreibung">Problembeschreibung</Label>
            <Textarea
              id="problembeschreibung"
              placeholder=""
              value={fields.problembeschreibung ?? ''}
              onChange={e => setFields(f => ({ ...f, problembeschreibung: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mitarbeiter">Zuständiger Mitarbeiter</Label>
            <Input
              id="mitarbeiter"
              placeholder=""
              value={fields.mitarbeiter ?? ''}
              onChange={e => setFields(f => ({ ...f, mitarbeiter: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="voraussichtliche_fertigstellung">Voraussichtliche Fertigstellung</Label>
            <DatePicker
              id="voraussichtliche_fertigstellung"
              placeholder=""
              mode="date"
              value={fields.voraussichtliche_fertigstellung ?? null}
              onChange={v => setFields(f => ({ ...f, voraussichtliche_fertigstellung: v ?? undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <div role="radiogroup" className="flex flex-wrap gap-1.5">
              <button
                type="button"
                role="radio"
                aria-checked={lookupKey(fields.status) === 'eingegangen'}
                onClick={() => setFields(f => ({ ...f, status: (lookupKey(f.status) === 'eingegangen' ? undefined : 'eingegangen') as any }))}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  lookupKey(fields.status) === 'eingegangen'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-foreground border-input hover:bg-accent'
                }`}
              >
                Eingegangen
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={lookupKey(fields.status) === 'in_bearbeitung'}
                onClick={() => setFields(f => ({ ...f, status: (lookupKey(f.status) === 'in_bearbeitung' ? undefined : 'in_bearbeitung') as any }))}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  lookupKey(fields.status) === 'in_bearbeitung'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-foreground border-input hover:bg-accent'
                }`}
              >
                In Bearbeitung
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={lookupKey(fields.status) === 'fertig_zur_abholung'}
                onClick={() => setFields(f => ({ ...f, status: (lookupKey(f.status) === 'fertig_zur_abholung' ? undefined : 'fertig_zur_abholung') as any }))}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  lookupKey(fields.status) === 'fertig_zur_abholung'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-foreground border-input hover:bg-accent'
                }`}
              >
                Fertig zur Abholung
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="interne_notizen">Interne Notizen</Label>
            <Textarea
              id="interne_notizen"
              placeholder=""
              value={fields.interne_notizen ?? ''}
              onChange={e => setFields(f => ({ ...f, interne_notizen: e.target.value }))}
              rows={3}
            />
          </div>

          <altcha-widget
            ref={captchaRef as any}
            challengeurl={`${PROXY_BASE}/api/_challenge?path=${encodeURIComponent(SUBMIT_PATH)}`}
            auto="onsubmit"
            hidefooter
          />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Wird gesendet...' : 'Absenden'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Powered by Klar
        </p>
      </div>
    </div>
  );
}
