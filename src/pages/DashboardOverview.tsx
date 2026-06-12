import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichReparaturauftraege } from '@/lib/enrich';
import type { EnrichedReparaturauftraege } from '@/types/enriched';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatCard, StatCardRow } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import {
  KanbanWidget,
  type KanbanCard,
  type KanbanColumn,
  type KanbanTone,
} from '@/components/widgets/KanbanWidget';
import {
  RecordOverlay,
  RecordHeader,
  RecordSection,
  RecordField,
  RecordRelation,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { ReparaturauftraegeDialog } from '@/components/dialogs/ReparaturauftraegeDialog';
import { KundenverwaltungDialog } from '@/components/dialogs/KundenverwaltungDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  IconAlertCircle,
  IconTool,
  IconRefresh,
  IconCheck,
  IconAlertTriangle,
  IconClock,
  IconCar,
  IconPhone,
  IconPlus,
  IconPackageExport,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a2a946a230a51374bc6d253';
const REPAIR_ENDPOINT = '/claude/build/repair';
const MAX_HEBEBUEHNEN = 3;

// Columns from schema
const COLUMNS: KanbanColumn[] = (LOOKUP_OPTIONS['reparaturauftraege']?.['status'] ?? []).map(o => ({
  key: o.key,
  label: o.label,
}));

function toneForStatus(status: string | undefined): KanbanTone {
  if (status === 'fertig_zur_abholung') return 'success';
  if (status === 'in_bearbeitung') return 'primary';
  return 'warning';
}

export default function DashboardOverview() {
  const clock = useClock();
  const {
    reparaturauftraege,
    setReparaturauftraege,
    kundenverwaltung,
    kundenverwaltungMap,
    loading,
    error,
    fetchAll,
  } = useDashboardData();

  const enriched = enrichReparaturauftraege(reparaturauftraege, { kundenverwaltungMap });

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<Record<string, unknown>>({});
  const [editRecord, setEditRecord] = useState<EnrichedReparaturauftraege | null>(null);
  const [kundeCreateOpen, setKundeCreateOpen] = useState(false);

  // Filter
  const [filter, setFilter] = useState<'all' | 'heute' | 'ueberfaellig' | 'abholung'>('all');

  const overlay = useRecordOverlayStack<{ id: string }>();

  // Today key
  const today = format(clock, 'yyyy-MM-dd');

  // Derived data
  const inBearbeitung = useMemo(
    () => enriched.filter(r => lookupKey(r.fields.status) === 'in_bearbeitung'),
    [enriched],
  );

  const ueberfaellig = useMemo(
    () =>
      enriched.filter(r => {
        const status = lookupKey(r.fields.status);
        if (status === 'fertig_zur_abholung') return false;
        const faellig = r.fields.voraussichtliche_fertigstellung;
        if (!faellig) return false;
        return faellig.slice(0, 10) < today;
      }),
    [enriched, today],
  );

  const heuteFilter = useMemo(
    () =>
      enriched.filter(r => {
        const status = lookupKey(r.fields.status);
        if (status === 'fertig_zur_abholung') return false;
        return r.fields.voraussichtliche_fertigstellung?.slice(0, 10) === today;
      }),
    [enriched, today],
  );

  const nichtAbgeholt = useMemo(
    () => enriched.filter(r => lookupKey(r.fields.status) === 'fertig_zur_abholung'),
    [enriched],
  );

  // KPI filtered records for board highlight
  const filteredCards = useMemo(() => {
    if (filter === 'heute') return new Set(heuteFilter.map(r => r.record_id));
    if (filter === 'ueberfaellig') return new Set(ueberfaellig.map(r => r.record_id));
    if (filter === 'abholung') return new Set(nichtAbgeholt.map(r => r.record_id));
    return null;
  }, [filter, heuteFilter, ueberfaellig, nichtAbgeholt]);

  // Advance status helper (shared across banner, list, overlay)
  const advanceStatus = (r: EnrichedReparaturauftraege) => {
    const status = lookupKey(r.fields.status);
    let next: string | null = null;
    if (status === 'eingegangen') next = 'in_bearbeitung';
    else if (status === 'in_bearbeitung') next = 'fertig_zur_abholung';
    if (!next) return;

    // Check capacity rule
    if (next === 'in_bearbeitung' && inBearbeitung.length >= MAX_HEBEBUEHNEN) {
      undoToast(`Alle ${MAX_HEBEBUEHNEN} Hebebühnen belegt — bitte zuerst einen Auftrag fertigstellen.`);
      return;
    }

    const prevFields = { ...r.fields };
    setReparaturauftraege(prev =>
      prev.map(x =>
        x.record_id === r.record_id
          ? { ...x, fields: { ...x.fields, status: { key: next!, label: next! } } }
          : x,
      ),
    );
    undoToast(
      next === 'fertig_zur_abholung'
        ? `${r.kundeName || r.fields.kennzeichen || 'Auftrag'} ist fertig — Kunde anrufen!`
        : `${r.kundeName || r.fields.kennzeichen || 'Auftrag'} in Bearbeitung`,
      () => {
        setReparaturauftraege(prev =>
          prev.map(x =>
            x.record_id === r.record_id ? { ...x, fields: { ...x.fields, ...prevFields } } : x,
          ),
        );
        LivingAppsService.updateReparaturauftraegeEntry(r.record_id, {
          status: (prevFields.status as { key: string } | undefined)?.key ?? 'eingegangen',
        }).catch(() => fetchAll());
      },
    );
    LivingAppsService.updateReparaturauftraegeEntry(r.record_id, { status: next }).catch(() =>
      fetchAll(),
    );
  };

  // Kanban card move
  const moveCard = async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;

    // Capacity rule: max 3 in_bearbeitung
    if (newColumn === 'in_bearbeitung' && inBearbeitung.length >= MAX_HEBEBUEHNEN) {
      return `Alle ${MAX_HEBEBUEHNEN} Hebebühnen belegt — bitte zuerst einen Auftrag fertigstellen.`;
    }

    const record = reparaturauftraege.find(r => r.record_id === rid);
    const prevStatus = record?.fields.status;

    setReparaturauftraege(prev =>
      prev.map(r =>
        r.record_id === rid
          ? { ...r, fields: { ...r.fields, status: { key: newColumn, label: newColumn } } }
          : r,
      ),
    );

    if (newColumn === 'fertig_zur_abholung') {
      const enrichedRecord = enriched.find(r => r.record_id === rid);
      undoToast(
        `${enrichedRecord?.kundeName || enrichedRecord?.fields.kennzeichen || 'Auftrag'} fertig — Kunde anrufen!`,
        () => {
          setReparaturauftraege(prev =>
            prev.map(r =>
              r.record_id === rid
                ? { ...r, fields: { ...r.fields, status: prevStatus } }
                : r,
            ),
          );
          LivingAppsService.updateReparaturauftraegeEntry(rid, {
            status: (prevStatus as { key: string } | undefined)?.key ?? 'in_bearbeitung',
          }).catch(() => fetchAll());
        },
      );
    } else {
      undoToast('Status aktualisiert');
    }

    try {
      await LivingAppsService.updateReparaturauftraegeEntry(rid, { status: newColumn });
    } catch {
      fetchAll();
    }
  };

  // Hooks must all be before early returns
  const cards = useMemo<KanbanCard[]>(
    () =>
      enriched.map(r => {
        const status = lookupKey(r.fields.status) ?? COLUMNS[0]?.key ?? '';
        const isHighlighted = filteredCards ? filteredCards.has(r.record_id) : true;
        const faelligDay = r.fields.voraussichtliche_fertigstellung?.slice(0, 10);
        const isUeberfaellig =
          !!faelligDay && faelligDay < today &&
          status !== 'fertig_zur_abholung';
        return {
          id: `reparatur:${r.record_id}`,
          column: status,
          title: (
            <span className={`font-medium ${isHighlighted ? '' : 'opacity-40'}`}>
              {r.kundeName || r.fields.kennzeichen || 'Auftrag'}
            </span>
          ),
          subtitle: (
            <span className={isHighlighted ? '' : 'opacity-40'}>
              {r.fields.kennzeichen ? <span className="font-mono text-xs">{r.fields.kennzeichen}</span> : null}
              {r.fields.kennzeichen && r.fields.voraussichtliche_fertigstellung ? ' · ' : ''}
              {r.fields.voraussichtliche_fertigstellung ? (
                <span className={isUeberfaellig ? 'text-destructive font-medium' : ''}>
                  {isUeberfaellig ? '⚠ ' : ''}
                  {formatDate(r.fields.voraussichtliche_fertigstellung)}
                </span>
              ) : null}
            </span>
          ),
          tone: isUeberfaellig ? 'destructive' : toneForStatus(status),
        };
      }),
    [enriched, filteredCards, today],
  );

  const overlayRecord = overlay.top
    ? enriched.find(r => r.record_id === overlay.top!.id)
    : undefined;

  const overlayKunde = overlayRecord?.fields.kunde
    ? kundenverwaltungMap.get(
        overlayRecord.fields.kunde.replace(/.*\//, ''),
      )
    : undefined;

  const nextStatusLabel = (r: EnrichedReparaturauftraege) => {
    const s = lookupKey(r.fields.status);
    if (s === 'eingegangen') return 'In Bearbeitung';
    if (s === 'in_bearbeitung') return 'Fertig melden';
    return null;
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Context line names
  const fertigHeuteNames = namen(heuteFilter.map(r => r.kundeName || r.fields.kennzeichen || '').filter(Boolean));
  const ueberfaelligNames = namen(ueberfaellig.map(r => r.kundeName || r.fields.kennzeichen || '').filter(Boolean));
  const contextLine = ueberfaellig.length > 0
    ? `${ueberfaelligNames} überfällig — bitte sofort bearbeiten.`
    : heuteFilter.length > 0
    ? `Heute fertig: ${fertigHeuteNames}.`
    : nichtAbgeholt.length > 0
    ? `${nichtAbgeholt.length} Fahrzeug${nichtAbgeholt.length > 1 ? 'e' : ''} warten auf Abholung.`
    : enriched.length === 0
    ? 'Richte deine Werkstatt ein — nimm den ersten Auftrag an.'
    : 'Alle Aufträge im Zeitplan.';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="mt-1 text-sm text-muted-foreground truncate max-w-xl">{contextLine}</p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setKundeCreateOpen(true); }}
          >
            <IconPlus size={16} className="mr-1 shrink-0" />
            <span className="hidden sm:inline">Neuer Kunde</span>
            <span className="sm:hidden">Kunde</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setCreateDefaults({ eingangsdatum: today });
              setCreateOpen(true);
            }}
          >
            <IconPlus size={16} className="mr-1 shrink-0" />
            <span className="hidden sm:inline">Neuer Auftrag</span>
            <span className="sm:hidden">Auftrag</span>
          </Button>
        </div>
      </div>

      <DashboardGrid
        hero={
          ueberfaellig.length > 0 ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              tone="destructive"
              action={{
                label: 'Fertig melden',
                onClick: () => advanceStatus(ueberfaellig[0]),
              }}
            >
              <b>{ueberfaelligNames}</b> — {ueberfaellig.length === 1 ? 'Auftrag' : 'Aufträge'} überfällig seit{' '}
              {formatDate(ueberfaellig[0].fields.voraussichtliche_fertigstellung)}.
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatCardRow>
            <StatCard
              title="Hebebühnen belegt"
              value={`${inBearbeitung.length} / ${MAX_HEBEBUEHNEN}`}
              description={
                inBearbeitung.length >= MAX_HEBEBUEHNEN
                  ? 'Alle Plätze belegt'
                  : `${MAX_HEBEBUEHNEN - inBearbeitung.length} frei`
              }
              icon={<IconTool size={18} className="text-muted-foreground" />}
              tone={
                inBearbeitung.length >= MAX_HEBEBUEHNEN
                  ? 'destructive'
                  : inBearbeitung.length >= MAX_HEBEBUEHNEN - 1
                  ? 'warning'
                  : 'default'
              }
            />
            <StatCard
              title="Heute fällig"
              value={heuteFilter.length}
              description={
                heuteFilter.length > 0
                  ? namen(heuteFilter.map(r => r.kundeName || r.fields.kennzeichen || '').filter(Boolean))
                  : 'Nichts heute fällig'
              }
              icon={<IconClock size={18} className="text-muted-foreground" />}
              tone={heuteFilter.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilter(f => f === 'heute' ? 'all' : 'heute')}
              active={filter === 'heute'}
            />
            <StatCard
              title="Wartet auf Abholung"
              value={nichtAbgeholt.length}
              description={
                nichtAbgeholt.length > 0
                  ? namen(nichtAbgeholt.map(r => r.kundeName || r.fields.kennzeichen || '').filter(Boolean))
                  : 'Keine wartenden Fahrzeuge'
              }
              icon={<IconPackageExport size={18} className="text-muted-foreground" />}
              tone={nichtAbgeholt.length > 0 ? 'primary' : 'default'}
              onClick={() => setFilter(f => f === 'abholung' ? 'all' : 'abholung')}
              active={filter === 'abholung'}
            />
          </StatCardRow>
        }
        aside={
          <>
            <WorkList
              title="Heute fällig & überfällig"
              icon={<IconClock size={14} className="shrink-0" />}
              items={[...ueberfaellig, ...heuteFilter.filter(r => !ueberfaellig.find(u => u.record_id === r.record_id))].map(r => {
                const isUeber = ueberfaellig.find(u => u.record_id === r.record_id);
                const nextLabel = nextStatusLabel(r);
                return {
                  id: r.record_id,
                  title: r.kundeName || r.fields.kennzeichen || 'Auftrag',
                  secondLine: (
                    <>
                      {isUeber
                        ? <span className="font-medium text-destructive">Überfällig</span>
                        : <span className="font-medium text-amber-600">Heute fällig</span>
                      }
                      {r.fields.kennzeichen && (
                        <span className="text-muted-foreground"> · {r.fields.kennzeichen}</span>
                      )}
                      {r.fields.voraussichtliche_fertigstellung && (
                        <span className="text-muted-foreground"> · {formatDate(r.fields.voraussichtliche_fertigstellung)}</span>
                      )}
                    </>
                  ),
                  icon: <IconCar size={14} className="shrink-0 text-muted-foreground" />,
                  action: nextLabel ? {
                    label: nextLabel,
                    onClick: () => advanceStatus(r),
                  } : undefined,
                };
              })}
              onItemClick={id => overlay.replace({ id })}
              empty={{
                text: 'Alles pünktlich — kein Auftrag heute fällig',
                action: {
                  label: 'Neuer Auftrag',
                  onClick: () => {
                    setCreateDefaults({ eingangsdatum: today });
                    setCreateOpen(true);
                  },
                },
              }}
            />
            <WorkList
              title="Fertig — noch nicht abgeholt"
              icon={<IconPhone size={14} className="shrink-0" />}
              items={nichtAbgeholt.map(r => {
                const kunde = r.fields.kunde
                  ? kundenverwaltungMap.get(r.fields.kunde.replace(/.*\//, ''))
                  : undefined;
                return {
                  id: r.record_id,
                  title: r.kundeName || r.fields.kennzeichen || 'Auftrag',
                  secondLine: (
                    <>
                      <span className="font-medium text-green-600">Fertig</span>
                      {r.fields.kennzeichen && (
                        <span className="text-muted-foreground"> · {r.fields.kennzeichen}</span>
                      )}
                      {kunde?.fields.telefon && (
                        <span className="text-muted-foreground"> · {kunde.fields.telefon}</span>
                      )}
                    </>
                  ),
                  icon: <IconPhone size={14} className="shrink-0 text-muted-foreground" />,
                  action: {
                    label: 'Angerufen',
                    onClick: () => {
                      overlay.replace({ id: r.record_id });
                    },
                  },
                };
              })}
              onItemClick={id => overlay.replace({ id })}
              empty={{
                text: 'Alle fertigen Fahrzeuge wurden abgeholt',
              }}
            />
          </>
        }
        primary={
          <KanbanWidget
            cards={cards}
            columns={COLUMNS}
            onCardClick={card => overlay.replace({ id: card.id.split(':')[1] ?? '' })}
            onCardMove={moveCard}
            onAddCard={column => {
              setCreateDefaults({ status: column, eingangsdatum: today });
              setCreateOpen(true);
            }}
            columnClassName={col => {
              if (col.key === 'in_bearbeitung' && inBearbeitung.length >= MAX_HEBEBUEHNEN) {
                return 'ring-2 ring-destructive/30';
              }
              return '';
            }}
          />
        }
      />

      {/* Record Overlay */}
      <RecordOverlay
        open={overlay.open}
        onClose={overlay.close}
        onEdit={() => {
          if (overlayRecord) {
            setEditRecord(overlayRecord);
            overlay.close();
          }
        }}
        editLabel="Bearbeiten"
        ariaLabel="Reparaturauftrag"
        footer={
          overlayRecord && nextStatusLabel(overlayRecord) ? (
            <button
              type="button"
              onClick={() => {
                advanceStatus(overlayRecord);
                overlay.close();
              }}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {nextStatusLabel(overlayRecord)}
            </button>
          ) : undefined
        }
      >
        {overlayRecord && (
          <>
            <RecordHeader
              title={overlayRecord.kundeName || overlayRecord.fields.kennzeichen || 'Auftrag'}
              subtitle={overlayRecord.fields.status?.label}
            />
            <RecordSection title="Fahrzeug" cols={2}>
              <RecordField label="Kennzeichen" value={overlayRecord.fields.kennzeichen} />
              <RecordField label="Fahrzeug" value={overlayRecord.fields.fahrzeug_bezeichnung} />
              <RecordField label="Eingangsdatum" value={overlayRecord.fields.eingangsdatum} format="date" />
              <RecordField
                label="Fertig bis"
                value={overlayRecord.fields.voraussichtliche_fertigstellung}
                format="date"
              />
            </RecordSection>
            <RecordSection title="Auftrag">
              <RecordField label="Auftragsnummer" value={overlayRecord.fields.auftragsnummer} />
              <RecordField label="Problem" value={overlayRecord.fields.problembeschreibung} format="longtext" />
              <RecordField label="Mitarbeiter" value={overlayRecord.fields.mitarbeiter} />
              <RecordField label="Interne Notizen" value={overlayRecord.fields.interne_notizen} format="longtext" />
            </RecordSection>
            {overlayKunde && (
              <RecordSection title="Kunde">
                <RecordRelation
                  label="Name"
                  name={`${overlayKunde.fields.vorname ?? ''} ${overlayKunde.fields.nachname ?? ''}`.trim()}
                  meta={overlayKunde.fields.telefon}
                />
                {overlayKunde.fields.email && (
                  <RecordField label="E-Mail" value={overlayKunde.fields.email} format="email" />
                )}
                {overlayKunde.fields.telefon && (
                  <RecordField label="Telefon" value={overlayKunde.fields.telefon} />
                )}
              </RecordSection>
            )}
            <RecordAttachments appId={APP_IDS.REPARATURAUFTRAEGE} recordId={overlayRecord.record_id} />
          </>
        )}
      </RecordOverlay>

      {/* Create/Edit dialog */}
      <ReparaturauftraegeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async fields => {
          await LivingAppsService.createReparaturauftraegeEntry(fields);
          fetchAll();
        }}
        defaultValues={createDefaults}
        kundenverwaltungList={kundenverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['Reparaturauftraege']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Reparaturauftraege']}
      />

      {editRecord && (
        <ReparaturauftraegeDialog
          open={!!editRecord}
          onClose={() => setEditRecord(null)}
          onSubmit={async fields => {
            await LivingAppsService.updateReparaturauftraegeEntry(editRecord.record_id, fields);
            fetchAll();
          }}
          defaultValues={editRecord.fields}
          recordId={editRecord.record_id}
          kundenverwaltungList={kundenverwaltung}
          enablePhotoScan={AI_PHOTO_SCAN['Reparaturauftraege']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Reparaturauftraege']}
        />
      )}

      {/* New customer dialog */}
      <KundenverwaltungDialog
        open={kundeCreateOpen}
        onClose={() => setKundeCreateOpen(false)}
        onSubmit={async fields => {
          await LivingAppsService.createKundenverwaltungEntry(fields);
          fetchAll();
        }}
        enablePhotoScan={AI_PHOTO_SCAN['Kundenverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Kundenverwaltung']}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          if (content.startsWith('[DONE]')) { setRepairDone(true); setRepairing(false); }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) setRepairFailed(true);
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen.</p>}
    </div>
  );
}
