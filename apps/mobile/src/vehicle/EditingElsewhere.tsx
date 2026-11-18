import { useTranslation } from 'react-i18next';

import { Notice } from '../ui/Notice';
import { useEditingElsewhere } from './usePresence';

// Info only: never blocks editing.
export function EditingElsewhere({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const others = useEditingElsewhere(vehicleId);
  if (!others || others.length === 0) return null;
  const name = others.filter(Boolean).join(', ');
  return <Notice text={name ? t('vehicleData.editingElsewhereNamed', { name }) : t('vehicleData.editingElsewhere')} />;
}
