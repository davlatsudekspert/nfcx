import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProfileStackParamList } from '../../navigation/types';
import { ScreenWithHeader } from '../shared/ScreenWithHeader';
import { PremiumTab } from '../../design-system/components/PremiumTab';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { ProfileView } from '../../composites/ProfileView';
import { recordsApi } from '../../api/records';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../state/authStore';
import { effectiveAccess, featureAllowed } from '../../lib/access';
import { useToast } from '../../design-system/components/PremiumToast';
import { color, space, type as typeTokens } from '../../design-system/tokens';
import type { NfcRecord } from '../../api/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileEdit'>;

/**
 * Profile Edit with a real Live Preview (brief §9) — a toggle between
 * "Tahrirlash"/"Ko'rish" tabs rather than a side-by-side split, since a
 * phone screen is too narrow for the desktop mockup's literal side panel;
 * "Ko'rish" renders the exact same `ProfileView` composite a real visitor
 * sees, fed with the in-progress draft, not the last-saved record.
 */
export function ProfileEditScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const cards = useAuthStore((s) => s.cards);
  const refresh = useAuthStore((s) => s.refresh);
  const toast = useToast();
  const queryClient = useQueryClient();
  const record = cards[0]; // primary card — a card-picker for multi-ID owners is a Phase-9 follow-up polish, not core to Live Preview itself

  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [draft, setDraft] = useState<Partial<NfcRecord>>(record ?? {});
  const [hashtagsText, setHashtagsText] = useState((record?.hashtags ?? []).join(', '));
  const [error, setError] = useState<string | null>(null);

  const access = effectiveAccess({ code: record?.code, tierOverride: record?.tierOverride }, { isPremium: user?.isPremium });
  const musicAllowed = featureAllowed('music', access);

  const save = useMutation({
    mutationFn: () =>
      recordsApi.update(record.code, {
        ...draft,
        hashtags: hashtagsText.split(',').map((h) => h.trim()).filter(Boolean),
      }),
    onSuccess: async () => {
      await refresh();
      queryClient.invalidateQueries({ queryKey: ['records', record.code] });
      toast.show('Profil saqlandi.', 'success');
      navigation.goBack();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Xizmat vaqtincha mavjud emas.'),
  });

  if (!record) {
    return (
      <ScreenWithHeader title="Profilni tahrirlash" onBack={navigation.goBack}>
        <Text style={styles.emptyText}>Avval NFC ID sotib oling.</Text>
      </ScreenWithHeader>
    );
  }

  const previewRecord: NfcRecord = { ...record, ...draft, hashtags: hashtagsText.split(',').map((h) => h.trim()).filter(Boolean) };

  return (
    <ScreenWithHeader title="Profilni tahrirlash" onBack={navigation.goBack} scroll={false}>
      <PremiumTab
        items={[{ key: 'edit', label: 'Tahrirlash' }, { key: 'preview', label: "Ko'rish" }]}
        activeKey={tab}
        onChange={(k) => setTab(k as 'edit' | 'preview')}
      />

      {tab === 'preview' ? (
        <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContent}>
          <ProfileView record={previewRecord} />
        </ScrollView>
      ) : (
        <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
          <PremiumInput label="Ism" value={draft.name ?? ''} onChangeText={(t) => setDraft((d) => ({ ...d, name: t }))} />
          <PremiumInput label="Rol / kasb" value={draft.role ?? ''} onChangeText={(t) => setDraft((d) => ({ ...d, role: t }))} />
          <PremiumInput label="Telefon" value={draft.phone ?? ''} onChangeText={(t) => setDraft((d) => ({ ...d, phone: t }))} keyboardType="phone-pad" />
          <PremiumInput label="Email" value={draft.email ?? ''} onChangeText={(t) => setDraft((d) => ({ ...d, email: t }))} autoCapitalize="none" />
          <PremiumInput label="Telegram" value={draft.tg ?? ''} onChangeText={(t) => setDraft((d) => ({ ...d, tg: t }))} autoCapitalize="none" />
          <PremiumInput label="WhatsApp" value={draft.whatsapp ?? ''} onChangeText={(t) => setDraft((d) => ({ ...d, whatsapp: t }))} />
          <PremiumInput label="Veb-sayt" value={draft.website ?? ''} onChangeText={(t) => setDraft((d) => ({ ...d, website: t }))} autoCapitalize="none" />
          <PremiumInput label="Hashtaglar (vergul bilan)" value={hashtagsText} onChangeText={setHashtagsText} />

          <PremiumInput
            label={musicAllowed ? 'Musiqa havolasi (YouTube / Yandex / mp3)' : 'Musiqa — Premium talab qilinadi'}
            value={draft.musicUrl ?? ''}
            onChangeText={(t) => setDraft((d) => ({ ...d, musicUrl: t }))}
            editable={musicAllowed}
            autoCapitalize="none"
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <PremiumButton label="Saqlash" onPress={() => save.mutate()} loading={save.isPending} />
        </ScrollView>
      )}
    </ScreenWithHeader>
  );
}

const styles = StyleSheet.create({
  form: { flex: 1 },
  formContent: { padding: space.lg, gap: space.xs },
  previewScroll: { flex: 1 },
  previewContent: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  emptyText: { ...typeTokens.body, color: color.textSecondary },
  error: { ...typeTokens.caption, color: color.danger, marginBottom: space.md },
});
