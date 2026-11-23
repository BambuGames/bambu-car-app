import { randomUUID } from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import type { Vehicle } from '../../../../domain/vehicle';
import { supabase } from '../../../../lib/supabase';
import { useSession } from '../../../../lib/session';
import { getVehicle, updateVehicle } from '../../../../local/vehicles';
import { applySuggestions } from '../../../../report/apply';
import { createReportApi, type ReportError, type Suggestion } from '../../../../report/api';
import { MAX_BYTES, MAX_FILES, TOO_LARGE, pickPdf, pickPhotos, takePhoto, type Picked } from '../../../../report/pickReport';
import { SuggestionRow, type Decision } from '../../../../report/SuggestionRow';
import { useSync } from '../../../../sync/SyncProvider';
import { Button } from '../../../../ui/Button';
import { Notice } from '../../../../ui/Notice';
import { Screen } from '../../../../ui/Screen';
import { colors, fonts, fontSize } from '../../../../ui/theme';
import { EditingElsewhere } from '../../../../vehicle/EditingElsewhere';

const api = createReportApi(supabase);
type Read = { id: string; paths: string[]; suggestions: Suggestion[] };
type Stage = 'idle' | 'uploading' | 'reading' | 'finishing';
type Problem = ReportError | 'tooLarge' | 'unreadable' | 'closeFailed';

// The model can repeat a part or a code; the first one counts.
function unique(list: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const key = s.kind === 'field' ? `f:${s.field}` : s.kind === 'damage' ? `d:${s.part}` : `e:${s.code}`;
    return !seen.has(key) && !!seen.add(key);
  });
}

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { db } = useSession();
  const { online, request, flush } = useSync();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [read, setRead] = useState<Read | null>(null);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [stage, setStage] = useState<Stage>('idle');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [applied, setApplied] = useState<number | null>(null);
  // finish runs once at a time (a ref, because a double tap can call it before the next render); once the values are
  // written the rows stay locked, and a retry only closes the read, so a later change of mind cannot leave a value behind.
  const finishing = useRef(false);
  const written = useRef(false);
  const [locked, setLocked] = useState(false);

  // A read that was left half-way comes back with fresh decisions (offline it simply is not found).
  useEffect(() => {
    if (!db || !id) return;
    let active = true;
    getVehicle(db, id).then((v) => active && setVehicle(v));
    api.openRead(id).then((open) => {
      if (active && open) setRead({ id: open.id, paths: open.files, suggestions: unique(open.suggestions) });
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [db, id]);

  const start = async (pick: () => Promise<Picked[] | null>) => {
    if (!vehicle || stage !== 'idle') return;
    setProblem(null);
    setApplied(null);
    let files: Picked[] | null;
    try {
      files = await pick();
    } catch (error) {
      return setProblem(error instanceof Error && error.message === TOO_LARGE ? 'tooLarge' : 'unreadable');
    }
    if (!files) return;
    if (files.length > MAX_FILES || files.reduce((sum, f) => sum + f.bytes.length, 0) > MAX_BYTES) return setProblem('tooLarge');

    const readId = randomUUID(); // every attempt has its own id and folder
    let paths: string[] = [];
    setStage('uploading');
    try {
      // The function checks the vehicle on the server: one created offline must be there first (else 403).
      if (!(await flush([{ kind: 'vehicle', id: vehicle.id }]))) return setProblem('offline');
      paths = await api.upload(vehicle.galleryId, vehicle.id, readId, files.map((f, i) => ({ bytes: f.bytes, mime: f.mime, name: `${i + 1}.${f.mime === 'application/pdf' ? 'pdf' : 'jpg'}` })));
      setStage('reading');
      const result = await api.read(vehicle.id, readId, paths);
      if ('error' in result) {
        await api.close(readId, paths).catch(() => undefined); // best effort; clean-reports deletes leftovers after 7 days
        return setProblem(result.error);
      }
      const suggestions = unique(result.suggestions);
      if (suggestions.length === 0) {
        // "The file was deleted" only once it was; otherwise the read stays open for "Abschließen", like any close failure.
        try {
          await api.close(readId, paths);
        } catch {
          setRead({ id: readId, paths, suggestions: [] });
          return setProblem('closeFailed');
        }
        return setApplied(0);
      }
      setDecisions({});
      setRead({ id: readId, paths, suggestions });
    } catch {
      setProblem(online ? 'internal' : 'offline');
    } finally {
      setStage('idle');
    }
  };

  const finish = async (current: Read, chosen: Record<number, Decision>) => {
    if (!db || !id || finishing.current) return;
    finishing.current = true;
    setLocked(true);
    setProblem(null);
    setStage('finishing');
    const accepted = current.suggestions.filter((_, i) => chosen[i] === 'accept');
    try {
      if (!written.current) {
        const fresh = await getVehicle(db, id);
        if (fresh && accepted.length > 0) await updateVehicle(db, id, applySuggestions(fresh, accepted), new Date().toISOString());
        written.current = true;
        request(); // send the new values now, the same way the other editors do
      }
      try {
        await api.close(current.id, current.paths);
      } catch {
        return setProblem('closeFailed'); // the vehicle keeps the values; the read stays open for another try
      }
      setRead(null);
      setApplied(accepted.length);
    } catch {
      setLocked(false); // nothing was written, the dealer may still change decisions
      setProblem('internal');
    } finally {
      finishing.current = false;
      setStage('idle');
    }
  };

  const decide = (index: number, decision: Decision) => {
    if (!read || locked || finishing.current) return;
    const next = { ...decisions, [index]: decision };
    setDecisions(next);
    if (online && read.suggestions.every((_, i) => next[i])) finish(read, next);
  };

  if (!vehicle) return null;
  const busy = stage !== 'idle';
  const open = read ? read.suggestions.filter((_, i) => !decisions[i]).length : 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('report.title') }} />
      <EditingElsewhere vehicleId={vehicle.id} />
      {problem ? <Notice kind="error" text={t(`report.errors.${problem}`)} /> : null}
      {!online ? <Notice text={t('report.offline')} /> : null}
      {stage === 'uploading' || stage === 'reading' ? <Notice text={t(`report.${stage}`)} /> : null}

      {read ? (
        <>
          {read.suggestions.length > 0 ? (
            <>
              <Text style={styles.heading} accessibilityRole="header">{t('report.review')}</Text>
              <Text style={styles.hint}>{t('report.reviewHint')}</Text>
            </>
          ) : null}
          {read.suggestions.map((s, i) => (
            <SuggestionRow key={i} suggestion={s} vehicle={vehicle} decision={decisions[i]} disabled={locked} onDecide={(d) => decide(i, d)} />
          ))}
          {open > 0 ? (
            <Text style={styles.hint}>{t('report.open', { count: open })}</Text>
          ) : (
            <Button label={t('report.finish')} onPress={() => finish(read, decisions)} disabled={!online} loading={stage === 'finishing'} />
          )}
        </>
      ) : applied !== null ? (
        <>
          <Notice text={applied > 0 ? t('report.done', { count: applied }) : t('report.nothing')} />
          <Button label={t('report.back')} onPress={() => router.back()} />
        </>
      ) : (
        <>
          <Text style={styles.hint}>{t('report.notice')}</Text>
          <Button label={t('report.pickPdf')} onPress={() => start(pickPdf)} disabled={!online || busy} loading={busy} />
          <Button label={t('report.pickPhotos')} onPress={() => start(pickPhotos)} variant="secondary" disabled={!online || busy} />
          <Button label={t('report.takePhotos')} onPress={() => start(takePhoto)} variant="secondary" disabled={!online || busy} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.title, fontSize: fontSize.title, color: colors.ink },
  hint: { fontSize: fontSize.small, color: colors.ink2 },
});
